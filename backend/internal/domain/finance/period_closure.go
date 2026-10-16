package finance

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type FinancePeriodClosure = model.FinancePeriodClosure
type ClosePeriodRequest = model.ClosePeriodRequest
type ReopenPeriodRequest = model.ReopenPeriodRequest

const (
	PeriodStatusClosed   = "closed"
	PeriodStatusLocked   = "locked"
	PeriodStatusReopened = "reopened"
)
