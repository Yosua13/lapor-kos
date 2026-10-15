package model

import (
	"testing"
	"time"
)

func TestCalculateDefaultSLADueDates(t *testing.T) {
	now := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)

	tests := []struct {
		name                 string
		priority             string
		impact               string
		expectedFirstRespDur time.Duration
		expectedResDur       time.Duration
	}{
		{
			name:                 "Urgent priority",
			priority:             ComplaintPriorityUrgent,
			impact:               ComplaintImpactMinor,
			expectedFirstRespDur: 1 * time.Hour,
			expectedResDur:       12 * time.Hour,
		},
		{
			name:                 "Emergency impact",
			priority:             ComplaintPriorityLow,
			impact:               ComplaintImpactEmergency,
			expectedFirstRespDur: 1 * time.Hour,
			expectedResDur:       12 * time.Hour,
		},
		{
			name:                 "High priority",
			priority:             ComplaintPriorityHigh,
			impact:               ComplaintImpactMinor,
			expectedFirstRespDur: 3 * time.Hour,
			expectedResDur:       24 * time.Hour,
		},
		{
			name:                 "Major impact",
			priority:             ComplaintPriorityMedium,
			impact:               ComplaintImpactMajor,
			expectedFirstRespDur: 3 * time.Hour,
			expectedResDur:       24 * time.Hour,
		},
		{
			name:                 "Medium priority",
			priority:             ComplaintPriorityMedium,
			impact:               ComplaintImpactMinor,
			expectedFirstRespDur: 6 * time.Hour,
			expectedResDur:       48 * time.Hour,
		},
		{
			name:                 "Low priority",
			priority:             ComplaintPriorityLow,
			impact:               ComplaintImpactMinor,
			expectedFirstRespDur: 24 * time.Hour,
			expectedResDur:       96 * time.Hour,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			firstRespDue, resDue := CalculateDefaultSLADueDates(now, tt.priority, tt.impact)
			if diff := firstRespDue.Sub(now); diff != tt.expectedFirstRespDur {
				t.Errorf("expected first response diff %v, got %v", tt.expectedFirstRespDur, diff)
			}
			if diff := resDue.Sub(now); diff != tt.expectedResDur {
				t.Errorf("expected resolution diff %v, got %v", tt.expectedResDur, diff)
			}
		})
	}
}

func TestEvaluateSLAStatus(t *testing.T) {
	now := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	firstRespPast := now.Add(-2 * time.Hour)
	firstRespFuture := now.Add(2 * time.Hour)
	resPast := now.Add(-1 * time.Hour)
	resFuture := now.Add(20 * time.Hour)
	resNearWarning := now.Add(2 * time.Hour) // within 4 hours

	t.Run("Open ticket within SLA", func(t *testing.T) {
		status := EvaluateSLAStatus(now, ComplaintStatusPending, nil, nil, &firstRespFuture, &resFuture)
		if status != SLAStatusWithinSLA {
			t.Errorf("expected %s, got %s", SLAStatusWithinSLA, status)
		}
	})

	t.Run("Open ticket missed first response breach", func(t *testing.T) {
		status := EvaluateSLAStatus(now, ComplaintStatusPending, nil, nil, &firstRespPast, &resFuture)
		if status != SLAStatusBreached {
			t.Errorf("expected %s, got %s", SLAStatusBreached, status)
		}
	})

	t.Run("Open ticket missed resolution breach", func(t *testing.T) {
		status := EvaluateSLAStatus(now, ComplaintStatusInProgress, &firstRespPast, nil, &firstRespPast, &resPast)
		if status != SLAStatusBreached {
			t.Errorf("expected %s, got %s", SLAStatusBreached, status)
		}
	})

	t.Run("Open ticket nearing deadline warning", func(t *testing.T) {
		firstRespRecorded := now.Add(-3 * time.Hour)
		status := EvaluateSLAStatus(now, ComplaintStatusInProgress, &firstRespRecorded, nil, &firstRespPast, &resNearWarning)
		if status != SLAStatusWarning {
			t.Errorf("expected %s, got %s", SLAStatusWarning, status)
		}
	})

	t.Run("Resolved within SLA", func(t *testing.T) {
		resolvedAt := now.Add(-5 * time.Hour)
		resolutionDue := now.Add(-2 * time.Hour) // resolved 3 hours before due
		status := EvaluateSLAStatus(now, ComplaintStatusResolved, nil, &resolvedAt, nil, &resolutionDue)
		if status != SLAStatusWithinSLA {
			t.Errorf("expected %s, got %s", SLAStatusWithinSLA, status)
		}
	})

	t.Run("Resolved breached", func(t *testing.T) {
		resolvedAt := now.Add(-1 * time.Hour)
		resolutionDue := now.Add(-3 * time.Hour) // resolved 2 hours late
		status := EvaluateSLAStatus(now, ComplaintStatusResolved, nil, &resolvedAt, nil, &resolutionDue)
		if status != SLAStatusBreached {
			t.Errorf("expected %s, got %s", SLAStatusBreached, status)
		}
	})
}
