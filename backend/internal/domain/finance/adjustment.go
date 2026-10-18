package finance

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type FinancePeriodAdjustment = model.FinancePeriodAdjustment
type FinancePeriodAdjustmentEvent = model.FinancePeriodAdjustmentEvent
type CreatePeriodAdjustmentRequest = model.CreatePeriodAdjustmentRequest
type ApproveAdjustmentRequest = model.ApproveAdjustmentRequest

const (
	AdjustmentPending  = "pending"
	AdjustmentApproved = "approved"
	AdjustmentRejected = "rejected"
)
