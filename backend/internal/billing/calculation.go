package billing

import "time"

// ClampDueDate applies the documented last-day policy. time.Date by itself
// rolls 31 February into March, which makes billing periods inconsistent.
func ClampDueDate(year int, month time.Month, day int, loc *time.Location) time.Time {
	if day < 1 {
		day = 1
	}
	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, loc).Day()
	if day > lastDay {
		day = lastDay
	}
	return time.Date(year, month, day, 23, 59, 59, 0, loc)
}

func PeriodStart(t time.Time, loc *time.Location) time.Time {
	local := t.In(loc)
	return time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, loc)
}

// ProrateMinor uses integer half-up rounding and therefore never introduces
// floating point drift into an invoice total.
func ProrateMinor(fullAmount int64, activeDays, daysInPeriod int) int64 {
	if fullAmount == 0 || activeDays <= 0 || daysInPeriod <= 0 {
		return 0
	}
	if activeDays >= daysInPeriod {
		return fullAmount
	}
	return (fullAmount*int64(activeDays) + int64(daysInPeriod/2)) / int64(daysInPeriod)
}

func ActiveDays(period, contractStart, contractEnd time.Time) (int, int) {
	periodStart := time.Date(period.Year(), period.Month(), 1, 0, 0, 0, 0, period.Location())
	periodEnd := periodStart.AddDate(0, 1, -1)
	start := periodStart
	if contractStart.After(start) {
		start = time.Date(contractStart.Year(), contractStart.Month(), contractStart.Day(), 0, 0, 0, 0, period.Location())
	}
	end := periodEnd
	if contractEnd.Before(end) {
		end = time.Date(contractEnd.Year(), contractEnd.Month(), contractEnd.Day(), 0, 0, 0, 0, period.Location())
	}
	if end.Before(start) {
		return 0, periodEnd.Day()
	}
	return int(end.Sub(start).Hours()/24) + 1, periodEnd.Day()
}
