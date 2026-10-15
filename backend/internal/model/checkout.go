package model

import (
	"time"

	"github.com/google/uuid"
)

// CheckoutCase represents an end-to-end checkout and tenancy termination case.
type CheckoutCase struct {
	ID                    uuid.UUID `json:"id"`
	PropertyID            uuid.UUID `json:"property_id"`
	ContractID            uuid.UUID `json:"contract_id"`
	TenantID              uuid.UUID `json:"tenant_id"`
	RoomID                uuid.UUID `json:"room_id"`
	Status                string    `json:"status"` // submitted, inspection_scheduled, inspection_completed, settlement_pending, approved, completed, cancelled
	ScheduledCheckoutDate string    `json:"scheduled_checkout_date"`
	ActualCheckoutDate    *string   `json:"actual_checkout_date,omitempty"`
	Reason                string    `json:"reason"`
	ForwardingAddress     string    `json:"forwarding_address"`
	BankName              string    `json:"bank_name"`
	BankAccountNumber     string    `json:"bank_account_number"`
	BankAccountHolder     string    `json:"bank_account_holder"`
	InspectionNotes       string    `json:"inspection_notes"`
	InspectedBy           *uuid.UUID `json:"inspected_by,omitempty"`
	InspectedAt           *time.Time `json:"inspected_at,omitempty"`
	KeyReturned           bool      `json:"key_returned"`
	KeyReturnedAt         *time.Time `json:"key_returned_at,omitempty"`
	RoomOverride          bool      `json:"room_override"`
	RoomOverrideReason    string    `json:"room_override_reason"`
	ApprovedBy            *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt            *time.Time `json:"approved_at,omitempty"`
	CompletedBy           *uuid.UUID `json:"completed_by,omitempty"`
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	CancellationReason    string    `json:"cancellation_reason"`
	CreatedBy             *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`

	// Joined details for rich display
	TenantName    string `json:"tenant_name,omitempty"`
	TenantEmail   string `json:"tenant_email,omitempty"`
	TenantPhone   string `json:"tenant_phone,omitempty"`
	RoomNumber    string `json:"room_number,omitempty"`
	RoomFloor     string `json:"room_floor,omitempty"`
	ContractStart string `json:"contract_start,omitempty"`
	ContractEnd   string `json:"contract_end,omitempty"`

	// Nested items
	Inspections []CheckoutInspection `json:"inspections,omitempty"`
	Settlement  *CheckoutSettlement  `json:"settlement,omitempty"`
}

// CheckoutInspection represents a physical room asset checklist item during checkout inspection.
type CheckoutInspection struct {
	ID              uuid.UUID `json:"id"`
	PropertyID      uuid.UUID `json:"property_id"`
	CheckoutID      uuid.UUID `json:"checkout_id"`
	ItemName        string    `json:"item_name"`
	Condition       string    `json:"condition"` // good, fair, damaged, missing, dirty
	RepairCostMinor int64     `json:"repair_cost_minor"`
	PhotoURL        string    `json:"photo_url"`
	Notes           string    `json:"notes"`
	InspectedAt     time.Time `json:"inspected_at"`
}

// CheckoutSettlement represents the audited financial settlement statement for a checkout.
type CheckoutSettlement struct {
	ID                  uuid.UUID      `json:"id"`
	PropertyID          uuid.UUID      `json:"property_id"`
	CheckoutID          uuid.UUID      `json:"checkout_id"`
	Currency            string         `json:"currency"`
	DepositHeldMinor    int64          `json:"deposit_held_minor"`
	UnpaidInvoicesMinor int64          `json:"unpaid_invoices_minor"`
	ProrataRentMinor    int64          `json:"prorata_rent_minor"`
	DamageChargesMinor  int64          `json:"damage_charges_minor"`
	UtilityChargesMinor int64          `json:"utility_charges_minor"`
	CreditBalanceMinor  int64          `json:"credit_balance_minor"`
	OtherChargesMinor   int64          `json:"other_charges_minor"`
	NetSettlementMinor  int64          `json:"net_settlement_minor"`
	SettlementType      string         `json:"settlement_type"` // refund, invoice, zero_balance
	DepositStatus       string         `json:"deposit_status"`  // pending, refund_requested, refund_approved, applied_to_deductions, forfeited, zero_balance
	RefundRequestID     *uuid.UUID     `json:"refund_request_id,omitempty"`
	FinalInvoiceID      *uuid.UUID     `json:"final_invoice_id,omitempty"`
	CalculationSnapshot map[string]any `json:"calculation_snapshot"`
	CreatedAt           time.Time      `json:"created_at"`
	UpdatedAt           time.Time      `json:"updated_at"`
}

// SettlementCalculation contains the pure calculated summary of a checkout financial settlement.
type SettlementCalculation struct {
	Currency                         string         `json:"currency"`
	DepositHeldMinor                 int64          `json:"deposit_held_minor"`
	CreditBalanceMinor               int64          `json:"credit_balance_minor"`
	TotalAvailableFundsMinor         int64          `json:"total_available_funds_minor"`
	UnpaidInvoicesMinor              int64          `json:"unpaid_invoices_minor"`
	ProrataRentMinor                 int64          `json:"prorata_rent_minor"`
	DamageChargesMinor               int64          `json:"damage_charges_minor"`
	UtilityChargesMinor              int64          `json:"utility_charges_minor"`
	OtherChargesMinor                int64          `json:"other_charges_minor"`
	TotalDeductionsMinor             int64          `json:"total_deductions_minor"`
	NetSettlementMinor               int64          `json:"net_settlement_minor"`
	SettlementType                   string         `json:"settlement_type"` // refund, invoice, zero_balance
	RefundAmountMinor                int64          `json:"refund_amount_minor"`
	InvoiceAmountMinor               int64          `json:"invoice_amount_minor"`
	DepositAppliedToDeductionsMinor  int64          `json:"deposit_applied_to_deductions_minor"`
	DepositStatus                    string         `json:"deposit_status"`
	Snapshot                         map[string]any `json:"snapshot"`
}

// Request and Filter Types
type CreateCheckoutNoticeRequest struct {
	ContractID            string `json:"contract_id" binding:"required"`
	ScheduledCheckoutDate string `json:"scheduled_checkout_date" binding:"required"`
	Reason                string `json:"reason" binding:"required"`
	ForwardingAddress     string `json:"forwarding_address"`
	BankName              string `json:"bank_name"`
	BankAccountNumber     string `json:"bank_account_number"`
	BankAccountHolder     string `json:"bank_account_holder"`
}

type RecordInspectionItemRequest struct {
	ItemName        string `json:"item_name" binding:"required"`
	Condition       string `json:"condition" binding:"required"` // good, fair, damaged, missing, dirty
	RepairCostMinor int64  `json:"repair_cost_minor"`
	PhotoURL        string `json:"photo_url"`
	Notes           string `json:"notes"`
}

type RecordInspectionRequest struct {
	Items           []RecordInspectionItemRequest `json:"items"`
	KeyReturned     bool                          `json:"key_returned"`
	InspectionNotes string                        `json:"inspection_notes"`
	ElectricityReading *UtilityReadingInput       `json:"electricity_reading,omitempty"`
	WaterReading       *UtilityReadingInput       `json:"water_reading,omitempty"`
}

type UtilityReadingInput struct {
	PreviousValue  float64 `json:"previous_value"`
	CurrentValue   float64 `json:"current_value"`
	UnitPriceMinor int64   `json:"unit_price_minor"`
}

type ApproveSettlementRequest struct {
	Notes string `json:"notes"`
}

type ExecuteCheckoutRequest struct {
	ActualCheckoutDate string `json:"actual_checkout_date"`
	TargetRoomStatus   string `json:"target_room_status"` // cleaning, available
	RoomOverride       bool   `json:"room_override"`
	RoomOverrideReason string `json:"room_override_reason"`
}

type RoomOverrideRequest struct {
	TargetRoomStatus string `json:"target_room_status" binding:"required"` // available, cleaning, maintenance
	Reason           string `json:"reason" binding:"required"`
}

type CancelCheckoutRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type CheckoutListFilter struct {
	Status    string
	TenantID  *uuid.UUID
	RoomID    *uuid.UUID
	StartDate string
	EndDate   string
	Page      int
	PageSize  int
}

type CheckoutListResponse struct {
	Items      []CheckoutCase `json:"items"`
	Page       int            `json:"page"`
	PageSize   int            `json:"page_size"`
	TotalItems int            `json:"total_items"`
	TotalPages int            `json:"total_pages"`
}
