package service

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

func TestAIService_FallbackAdvisory(t *testing.T) {
	aiSvc := NewAIService() // API key will be empty in unit test environment

	tests := []struct {
		name             string
		category         string
		title            string
		description      string
		expectedPriority string
		expectedImpact   string
	}{
		{
			name:             "Urgent leakage flooding",
			category:         "facility",
			title:            "Pipa pecah banjir kamar mandi",
			description:      "Ada kebocoran parah di kamar mandi air meluap ke kamar tidur",
			expectedPriority: model.ComplaintPriorityUrgent,
			expectedImpact:   model.ComplaintImpactEmergency,
		},
		{
			name:             "High priority AC broken",
			category:         "facility",
			title:            "AC rusak tidak dingin",
			description:      "Unit AC mati total dan mengeluarkan suara berdengung",
			expectedPriority: model.ComplaintPriorityHigh,
			expectedImpact:   model.ComplaintImpactMajor,
		},
		{
			name:             "Noisy complaint",
			category:         "noisy",
			title:            "Keributan larut malam",
			description:      "Tetangga sebelah bernyanyi kencang jam 1 pagi",
			expectedPriority: model.ComplaintPriorityHigh,
			expectedImpact:   model.ComplaintImpactMajor,
		},
		{
			name:             "Medium priority standard",
			category:         "cleanliness",
			title:            "Tempat sampah lorong penuh",
			description:      "Tolong dibersihkan tempat sampah di depan kamar",
			expectedPriority: model.ComplaintPriorityMedium,
			expectedImpact:   model.ComplaintImpactMinor,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sug, err := aiSvc.GenerateAdvisory(context.Background(), tt.category, tt.title, tt.description)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if sug == nil {
				t.Fatal("expected non-nil AI suggestion")
			}
			if sug.SuggestedPriority != tt.expectedPriority {
				t.Errorf("expected priority %s, got %s", tt.expectedPriority, sug.SuggestedPriority)
			}
			if sug.SuggestedImpact != tt.expectedImpact {
				t.Errorf("expected impact %s, got %s", tt.expectedImpact, sug.SuggestedImpact)
			}
			if sug.ConfidenceScore <= 0 {
				t.Errorf("expected positive confidence score, got %f", sug.ConfidenceScore)
			}
			if sug.Summary == "" {
				t.Error("expected non-empty summary")
			}
			if sug.DraftResponse == "" {
				t.Error("expected non-empty draft response")
			}
		})
	}
}
