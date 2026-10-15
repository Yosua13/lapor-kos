package notification

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

// ParseTimeOfDay parses "HH:mm" into minutes from midnight (0..1439)
func ParseTimeOfDay(s string) (int, error) {
	parts := strings.Split(strings.TrimSpace(s), ":")
	if len(parts) != 2 {
		return 0, fmt.Errorf("invalid time format %q, expected HH:mm", s)
	}
	h, err := strconv.Atoi(parts[0])
	if err != nil || h < 0 || h > 23 {
		return 0, fmt.Errorf("invalid hour %q in %q", parts[0], s)
	}
	m, err := strconv.Atoi(parts[1])
	if err != nil || m < 0 || m > 59 {
		return 0, fmt.Errorf("invalid minute %q in %q", parts[1], s)
	}
	return h*60 + m, nil
}

// IsInQuietHours checks if the given time `now` falls into the quiet hours window.
// start and end are in "HH:mm" format (e.g. "22:00" and "07:00").
// If start > end, the window spans midnight (e.g. 22:00 to 07:00).
func IsInQuietHours(now time.Time, startStr, endStr, timezone string) bool {
	if strings.TrimSpace(startStr) == "" || strings.TrimSpace(endStr) == "" {
		return false
	}

	startMinutes, err := ParseTimeOfDay(startStr)
	if err != nil {
		return false
	}
	endMinutes, err := ParseTimeOfDay(endStr)
	if err != nil {
		return false
	}

	if startMinutes == endMinutes {
		return false // zero-length quiet hours
	}

	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc, _ = time.LoadLocation("Asia/Jakarta")
		if loc == nil {
			loc = time.UTC
		}
	}

	localNow := now.In(loc)
	currentMinutes := localNow.Hour()*60 + localNow.Minute()

	if startMinutes < endMinutes {
		// Window on the same calendar day, e.g. 13:00 to 16:00
		return currentMinutes >= startMinutes && currentMinutes < endMinutes
	}

	// Window spans midnight, e.g. 22:00 to 07:00
	return currentMinutes >= startMinutes || currentMinutes < endMinutes
}
