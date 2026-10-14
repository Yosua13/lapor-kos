package billing

import (
	"testing"
	"time"
)

func TestClampDueDate(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	cases := []struct{ year int; month time.Month; day, want int }{
		{2025, time.February, 31, 28},
		{2024, time.February, 30, 29},
		{2025, time.April, 31, 30},
		{2025, time.January, 31, 31},
		{2025, time.June, 28, 28},
		{2025, time.May, 0, 1},
		{2025, time.February, -5, 1},
	}
	for _, tc := range cases {
		got := ClampDueDate(tc.year, tc.month, tc.day, loc)
		if got.Day() != tc.want || got.Month() != tc.month {
			t.Fatalf("ClampDueDate(%d, %s, %d) = %s, want day %d in same month", tc.year, tc.month, tc.day, got, tc.want)
		}
	}
}

func TestPeriodStart(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	sample := time.Date(2026, time.March, 25, 15, 30, 0, 0, loc)
	start := PeriodStart(sample, loc)
	if start.Day() != 1 || start.Month() != time.March || start.Year() != 2026 || start.Hour() != 0 {
		t.Fatalf("unexpected PeriodStart: %v", start)
	}
}

func TestProrateMinorUsesIntegerHalfUpRounding(t *testing.T) {
	if got := ProrateMinor(1_000_000, 15, 31); got != 483_871 {
		t.Fatalf("got %d", got)
	}
	if got := ProrateMinor(1_000_000, 31, 31); got != 1_000_000 {
		t.Fatalf("full period got %d", got)
	}
	if got := ProrateMinor(1_000_000, 35, 31); got != 1_000_000 {
		t.Fatalf("exceeded period got %d", got)
	}
	if got := ProrateMinor(1_000_000, 0, 31); got != 0 {
		t.Fatalf("zero active days got %d", got)
	}
	if got := ProrateMinor(0, 15, 31); got != 0 {
		t.Fatalf("zero full amount got %d", got)
	}
	if got := ProrateMinor(1_000_000, 15, 0); got != 0 {
		t.Fatalf("zero days in period got %d", got)
	}
}

func TestActiveDays(t *testing.T) {
	loc := time.UTC
	period := time.Date(2026, time.January, 1, 0, 0, 0, 0, loc)
	start := time.Date(2026, time.January, 17, 0, 0, 0, 0, loc)
	end := time.Date(2026, time.March, 5, 0, 0, 0, 0, loc)
	active, total := ActiveDays(period, start, end)
	if active != 15 || total != 31 {
		t.Fatalf("active=%d total=%d", active, total)
	}

	// Contract ended before period
	pastEnd := time.Date(2025, time.December, 31, 0, 0, 0, 0, loc)
	activePast, _ := ActiveDays(period, time.Date(2025, time.January, 1, 0, 0, 0, 0, loc), pastEnd)
	if activePast != 0 {
		t.Fatalf("expected 0 active days for past contract, got %d", activePast)
	}

	// Full month
	fullStart := time.Date(2025, time.January, 1, 0, 0, 0, 0, loc)
	fullEnd := time.Date(2027, time.January, 1, 0, 0, 0, 0, loc)
	activeFull, totalFull := ActiveDays(period, fullStart, fullEnd)
	if activeFull != 31 || totalFull != 31 {
		t.Fatalf("expected 31/31, got %d/%d", activeFull, totalFull)
	}
}

