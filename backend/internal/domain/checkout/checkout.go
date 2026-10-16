package checkout

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type CheckoutCase = model.CheckoutCase
type CheckoutInspection = model.CheckoutInspection
type CheckoutSettlement = model.CheckoutSettlement
type SettlementCalculation = model.SettlementCalculation
type CreateCheckoutNoticeRequest = model.CreateCheckoutNoticeRequest
type RecordInspectionRequest = model.RecordInspectionRequest
type ApproveSettlementRequest = model.ApproveSettlementRequest
type ExecuteCheckoutRequest = model.ExecuteCheckoutRequest
type CancelCheckoutRequest = model.CancelCheckoutRequest
type RoomOverrideRequest = model.RoomOverrideRequest
type CheckoutListFilter = model.CheckoutListFilter
type CheckoutListResponse = model.CheckoutListResponse

const (
	StatusSubmitted            = "submitted"
	StatusInspectionScheduled  = "inspection_scheduled"
	StatusInspectionCompleted  = "inspection_completed"
	StatusSettlementPending    = "settlement_pending"
	StatusApproved             = "approved"
	StatusCompleted            = "completed"
	StatusCancelled            = "cancelled"
)
