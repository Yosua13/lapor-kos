package model

import (
	"time"

	"github.com/google/uuid"
)

type RoomTransferStatus string

const (
	RoomTransferPending   RoomTransferStatus = "pending"
	RoomTransferApproved  RoomTransferStatus = "approved"
	RoomTransferCompleted RoomTransferStatus = "completed"
	RoomTransferRejected  RoomTransferStatus = "rejected"
	RoomTransferCancelled RoomTransferStatus = "cancelled"
)

type RoomTransfer struct {
	ID                  uuid.UUID          `json:"id"`
	PropertyID          uuid.UUID          `json:"property_id"`
	ContractID          uuid.UUID          `json:"contract_id"`
	TenantID            uuid.UUID          `json:"tenant_id"`
	FromRoomID          uuid.UUID          `json:"from_room_id"`
	ToRoomID            uuid.UUID          `json:"to_room_id"`
	RequestedBy         uuid.UUID          `json:"requested_by"`
	EffectiveDate       time.Time          `json:"effective_date"`
	TargetEndDate       time.Time          `json:"target_end_date"`
	Status              RoomTransferStatus `json:"status"`
	Reason              string             `json:"reason"`
	RejectionReason     string             `json:"rejection_reason"`
	ApprovedBy          *uuid.UUID         `json:"approved_by,omitempty"`
	ApprovedAt          *time.Time         `json:"approved_at,omitempty"`
	CompletedAt         *time.Time         `json:"completed_at,omitempty"`
	CalculationPreview  TransferCalculation `json:"calculation_preview"`
	AdjustmentInvoiceID *uuid.UUID         `json:"adjustment_invoice_id,omitempty"`
	CreatedAt           time.Time          `json:"created_at"`
	UpdatedAt           time.Time          `json:"updated_at"`

	// Extended presentation fields
	TenantName      string `json:"tenant_name,omitempty"`
	TenantEmail     string `json:"tenant_email,omitempty"`
	TenantPhone     string `json:"tenant_phone,omitempty"`
	FromRoomNumber  string `json:"from_room_number,omitempty"`
	ToRoomNumber    string `json:"to_room_number,omitempty"`
	RequestedByName string `json:"requested_by_name,omitempty"`
	ApprovedByName  string `json:"approved_by_name,omitempty"`
}

type TransferCalculation struct {
	ContractID                 uuid.UUID `json:"contract_id"`
	FromRoomID                 uuid.UUID `json:"from_room_id"`
	FromRoomNumber             string    `json:"from_room_number"`
	FromRoomPriceMinor         int64     `json:"from_room_price_minor"`
	ToRoomID                   uuid.UUID `json:"to_room_id"`
	ToRoomNumber               string    `json:"to_room_number"`
	ToRoomPriceMinor           int64     `json:"to_room_price_minor"`
	EffectiveDate              string    `json:"effective_date"`
	TargetEndDate              string    `json:"target_end_date"`
	BillingPeriodStart         string    `json:"billing_period_start"`
	BillingPeriodEnd           string    `json:"billing_period_end"`
	DaysInPeriod               int       `json:"days_in_period"`
	ActiveDaysRemaining        int       `json:"active_days_remaining"`
	UnusedOldRentProratedMinor int64     `json:"unused_old_rent_prorated_minor"`
	NewRentProratedMinor       int64     `json:"new_rent_prorated_minor"`
	RentDifferenceMinor        int64     `json:"rent_difference_minor"`
	DepositOldMinor            int64     `json:"deposit_old_minor"`
	DepositNewMinor            int64     `json:"deposit_new_minor"`
	DepositDifferenceMinor     int64     `json:"deposit_difference_minor"`
	MoveFeeMinor               int64     `json:"move_fee_minor"`
	TenantCreditBalanceMinor   int64     `json:"tenant_credit_balance_minor"`
	CreditAppliedMinor         int64     `json:"credit_applied_minor"`
	NetTotalAdjustmentMinor    int64     `json:"net_total_adjustment_minor"`
	OutstandingInvoicesMinor   int64     `json:"outstanding_invoices_minor"`
	Currency                   string    `json:"currency"`
}

type TenantRoomHistoryItem struct {
	ID                 uuid.UUID  `json:"id"`
	PropertyID         uuid.UUID  `json:"property_id"`
	ContractID         uuid.UUID  `json:"contract_id"`
	RoomID             uuid.UUID  `json:"room_id"`
	RoomNumber         string     `json:"room_number"`
	RoomType           string     `json:"room_type"`
	PricePerMonthMinor int64      `json:"price_per_month_minor"`
	UserID             uuid.UUID  `json:"user_id"`
	TenantName         string     `json:"tenant_name"`
	StartDate          time.Time  `json:"start_date"`
	EndDate            time.Time  `json:"end_date"`
	ClosedAt           *time.Time `json:"closed_at,omitempty"`
	IsCurrent          bool       `json:"is_current"`
	TransferID         *uuid.UUID `json:"transfer_id,omitempty"`
	TransferReason     string     `json:"transfer_reason,omitempty"`
	CreatedAt          time.Time  `json:"created_at"`
}

type CreateTransferRequest struct {
	ContractID    *uuid.UUID `json:"contract_id"`
	TenantID      *uuid.UUID `json:"tenant_id"`
	ToRoomID      uuid.UUID  `json:"to_room_id" binding:"required"`
	EffectiveDate string     `json:"effective_date" binding:"required"`
	Reason        string     `json:"reason" binding:"required"`
	MoveFeeMinor  int64      `json:"move_fee_minor"`
}

type PreviewTransferRequest struct {
	ContractID    *uuid.UUID `json:"contract_id"`
	TenantID      *uuid.UUID `json:"tenant_id"`
	ToRoomID      uuid.UUID  `json:"to_room_id" binding:"required"`
	EffectiveDate string     `json:"effective_date" binding:"required"`
	MoveFeeMinor  int64      `json:"move_fee_minor"`
}

type RejectTransferRequest struct {
	Reason string `json:"reason" binding:"required"`
}
