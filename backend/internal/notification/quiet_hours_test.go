package notification

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestIsInQuietHours(t *testing.T) {
	locJakarta, err := time.LoadLocation("Asia/Jakarta")
	assert.NoError(t, err)

	tests := []struct {
		name      string
		now       time.Time
		start     string
		end       string
		tz        string
		expected  bool
	}{
		{
			name:     "23:30 inside 22:00-07:00 window (spans midnight)",
			now:      time.Date(2026, 10, 15, 23, 30, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Asia/Jakarta",
			expected: true,
		},
		{
			name:     "03:15 inside 22:00-07:00 window (spans midnight)",
			now:      time.Date(2026, 10, 15, 3, 15, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Asia/Jakarta",
			expected: true,
		},
		{
			name:     "22:00 exact start time (inclusive)",
			now:      time.Date(2026, 10, 15, 22, 0, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Asia/Jakarta",
			expected: true,
		},
		{
			name:     "07:00 exact end time (exclusive)",
			now:      time.Date(2026, 10, 15, 7, 0, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Asia/Jakarta",
			expected: false,
		},
		{
			name:     "12:00 noon outside 22:00-07:00 window",
			now:      time.Date(2026, 10, 15, 12, 0, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Asia/Jakarta",
			expected: false,
		},
		{
			name:     "14:30 inside daytime window 13:00-15:00",
			now:      time.Date(2026, 10, 15, 14, 30, 0, 0, locJakarta),
			start:    "13:00",
			end:      "15:00",
			tz:       "Asia/Jakarta",
			expected: true,
		},
		{
			name:     "16:00 outside daytime window 13:00-15:00",
			now:      time.Date(2026, 10, 15, 16, 0, 0, 0, locJakarta),
			start:    "13:00",
			end:      "15:00",
			tz:       "Asia/Jakarta",
			expected: false,
		},
		{
			name:     "Fallback for invalid timezone",
			now:      time.Date(2026, 10, 15, 23, 0, 0, 0, locJakarta),
			start:    "22:00",
			end:      "07:00",
			tz:       "Invalid/Unknown_TZ",
			expected: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			actual := IsInQuietHours(tc.now, tc.start, tc.end, tc.tz)
			assert.Equal(t, tc.expected, actual)
		})
	}
}
