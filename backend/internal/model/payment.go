package model

import (
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	PropertyID        uuid.UUID  `json:"property_id" db:"property_id"`
	ContractID        uuid.UUID  `json:"contract_id" db:"contract_id"`
	TenantID          *uuid.UUID `json:"tenant_id,omitempty" db:"tenant_id"`
	OwnerID           *uuid.UUID `json:"owner_id,omitempty" db:"owner_id"`
	PeriodMonth       int        `json:"period_month" db:"period_month"`
	PeriodYear        int        `json:"period_year" db:"period_year"`
	AmountRent        float64    `json:"amount_rent" db:"amount_rent"`
	AmountElectricity float64    `json:"amount_electricity" db:"amount_electricity"`
	AmountWater       float64    `json:"amount_water" db:"amount_water"`
	AmountOther       float64    `json:"amount_other" db:"amount_other"`
	TotalPaid         float64    `json:"total_paid" db:"total_paid"`
	AmountMinor       int64      `json:"amount_minor" db:"amount_minor"`
	PaidAmountMinor   int64      `json:"paid_amount_minor" db:"paid_amount_minor"`
	Currency          string     `json:"currency" db:"currency"`
	PaymentMethod     string     `json:"payment_method" db:"payment_method"`
	Provider          string     `json:"provider" db:"provider"`
	ProviderRef       *string    `json:"provider_ref,omitempty" db:"provider_ref"`
	Status            string     `json:"status" db:"status"` // unpaid, pending, paid, partial, overdue, rejected, refunded, void
	ProofPhotoURL     string     `json:"proof_photo_url" db:"proof_photo_url"`
	PaidAt            *time.Time `json:"paid_at" db:"paid_at"`
	DueDate           time.Time  `json:"due_date" db:"due_date"`
	Notes             string     `json:"notes" db:"notes"`
	VerifiedBy        *uuid.UUID `json:"verified_by,omitempty" db:"verified_by"`
	VerifiedAt        *time.Time `json:"verified_at,omitempty" db:"verified_at"`
	VerificationNotes string     `json:"verification_notes" db:"verification_notes"`
	RejectionReason   string     `json:"rejection_reason" db:"rejection_reason"`
	InvoiceID         *uuid.UUID `json:"invoice_id,omitempty" db:"invoice_id"`
	ParentPaymentID   *uuid.UUID `json:"parent_payment_id,omitempty" db:"parent_payment_id"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`

	// Preloaded / Joined data
	Contract    *Contract           `json:"contract,omitempty"`
	Proofs      []PaymentProof      `json:"proofs,omitempty"`
	Allocations []InvoiceAllocation `json:"allocations,omitempty"`
	Receipt     *PaymentReceipt     `json:"receipt,omitempty"`
	Verifier    *User               `json:"verifier,omitempty"`
}

type PaymentProof struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	PropertyID    uuid.UUID  `json:"property_id" db:"property_id"`
	PaymentID     uuid.UUID  `json:"payment_id" db:"payment_id"`
	FileURL       string     `json:"file_url" db:"file_url"`
	AmountMinor   int64      `json:"amount_minor" db:"amount_minor"`
	PaymentMethod string     `json:"payment_method" db:"payment_method"`
	SubmittedBy   *uuid.UUID `json:"submitted_by,omitempty" db:"submitted_by"`
	Notes         string     `json:"notes" db:"notes"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

type PaymentReceipt struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	PropertyID    uuid.UUID              `json:"property_id" db:"property_id"`
	PaymentID     uuid.UUID              `json:"payment_id" db:"payment_id"`
	ReceiptNumber string                 `json:"receipt_number" db:"receipt_number"`
	TenantID      uuid.UUID              `json:"tenant_id" db:"tenant_id"`
	TotalMinor    int64                  `json:"total_minor" db:"total_minor"`
	Currency      string                 `json:"currency" db:"currency"`
	Snapshot      map[string]interface{} `json:"snapshot" db:"snapshot"`
	Checksum      string                 `json:"checksum" db:"checksum"`
	IssuedBy      *uuid.UUID             `json:"issued_by,omitempty" db:"issued_by"`
	IssuedAt      time.Time              `json:"issued_at" db:"issued_at"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
}

type TenantCredit struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	PropertyID        uuid.UUID  `json:"property_id" db:"property_id"`
	TenantID          uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	SourcePaymentID   *uuid.UUID `json:"source_payment_id,omitempty" db:"source_payment_id"`
	AmountMinor       int64      `json:"amount_minor" db:"amount_minor"`
	BalanceAfterMinor int64      `json:"balance_after_minor" db:"balance_after_minor"`
	Reason            string     `json:"reason" db:"reason"`
	CreatedBy         *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
}

type RefundRequest struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	PropertyID        uuid.UUID  `json:"property_id" db:"property_id"`
	PaymentID         uuid.UUID  `json:"payment_id" db:"payment_id"`
	TenantID          uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	AmountMinor       int64      `json:"amount_minor" db:"amount_minor"`
	Status            string     `json:"status" db:"status"` // requested, approved, rejected, disbursed
	Reason            string     `json:"reason" db:"reason"`
	BankName          string     `json:"bank_name" db:"bank_name"`
	BankAccountNumber string     `json:"bank_account_number" db:"bank_account_number"`
	BankAccountHolder string     `json:"bank_account_holder" db:"bank_account_holder"`
	ProcessedBy       *uuid.UUID `json:"processed_by,omitempty" db:"processed_by"`
	ProcessedAt       *time.Time `json:"processed_at,omitempty" db:"processed_at"`
	DisbursementRef   string     `json:"disbursement_ref" db:"disbursement_ref"`
	Notes             string     `json:"notes" db:"notes"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
}

type NotificationOutboxItem struct {
	ID            uuid.UUID              `json:"id" db:"id"`
	PropertyID    uuid.UUID              `json:"property_id" db:"property_id"`
	EventType     string                 `json:"event_type" db:"event_type"`
	AggregateType string                 `json:"aggregate_type" db:"aggregate_type"`
	AggregateID   uuid.UUID              `json:"aggregate_id" db:"aggregate_id"`
	Payload       map[string]interface{} `json:"payload" db:"payload"`
	Status        string                 `json:"status" db:"status"` // pending, processing, delivered, failed
	RetryCount    int                    `json:"retry_count" db:"retry_count"`
	LastError     *string                `json:"last_error,omitempty" db:"last_error"`
	CreatedAt     time.Time              `json:"created_at" db:"created_at"`
	DeliveredAt   *time.Time             `json:"delivered_at,omitempty" db:"delivered_at"`
}

type SubmitPaymentRequest struct {
	PaymentMethod string     `form:"payment_method" json:"payment_method" binding:"required"`
	TotalPaid     float64    `form:"total_paid" json:"total_paid" binding:"required"`
	AmountMinor   int64      `form:"amount_minor" json:"amount_minor"`
	InvoiceID     *uuid.UUID `form:"invoice_id" json:"invoice_id"`
	Notes         string     `form:"notes" json:"notes"`
}

type VerifyPaymentRequest struct {
	AmountRent        float64           `json:"amount_rent"`
	AmountElectricity float64           `json:"amount_electricity"`
	AmountWater       float64           `json:"amount_water"`
	AmountOther       float64           `json:"amount_other"`
	TotalPaid         float64           `json:"total_paid"`
	PaidAmountMinor   int64             `json:"paid_amount_minor"`
	Status            string            `json:"status" binding:"required"` // paid, partial, unpaid, overdue, rejected
	Notes             string            `json:"notes"`
	RejectionReason   string            `json:"rejection_reason"`
	Allocations       []AllocationInput `json:"allocations"`
	CreditOverpayment bool              `json:"credit_overpayment"`
}

type AllocationInput struct {
	InvoiceID   uuid.UUID `json:"invoice_id" binding:"required"`
	AmountMinor int64     `json:"amount_minor" binding:"required"`
	Reason      string    `json:"reason"`
}

type RejectPaymentRequest struct {
	RejectionReason string `json:"rejection_reason" binding:"required"`
}

type PaymentWebhookPayload struct {
	Provider      string     `json:"provider" binding:"required"`
	ProviderRef   string     `json:"provider_ref" binding:"required"`
	AmountMinor   int64      `json:"amount_minor" binding:"required"`
	PropertyID    uuid.UUID  `json:"property_id" binding:"required"`
	ContractID    *uuid.UUID `json:"contract_id"`
	InvoiceID     *uuid.UUID `json:"invoice_id"`
	PaymentMethod string     `json:"payment_method"`
	Status        string     `json:"status" binding:"required"` // PAID, SETTLED, PENDING, FAILED
	Notes         string     `json:"notes"`
	Signature     string     `json:"signature"`
}

type CreateRefundRequestPayload struct {
	PaymentID         uuid.UUID `json:"payment_id" binding:"required"`
	AmountMinor       int64     `json:"amount_minor" binding:"required"`
	Reason            string    `json:"reason" binding:"required"`
	BankName          string    `json:"bank_name" binding:"required"`
	BankAccountNumber string    `json:"bank_account_number" binding:"required"`
	BankAccountHolder string    `json:"bank_account_holder" binding:"required"`
}

type ProcessRefundPayload struct {
	Status          string `json:"status" binding:"required"` // approved, rejected, disbursed
	DisbursementRef string `json:"disbursement_ref"`
	Notes           string `json:"notes"`
}

type ReconciliationReport struct {
	PropertyID                  uuid.UUID                      `json:"property_id"`
	PeriodStart                 string                         `json:"period_start"`
	PeriodEnd                   string                         `json:"period_end"`
	TotalPaymentsReceivedMinor  int64                          `json:"total_payments_received_minor"`
	TotalAllocatedMinor         int64                          `json:"total_allocated_minor"`
	TotalUnallocatedMinor       int64                          `json:"total_unallocated_minor"`
	TotalCreditsCreatedMinor    int64                          `json:"total_credits_created_minor"`
	TotalRefundedMinor          int64                          `json:"total_refunded_minor"`
	TotalSettlementMinor        int64                          `json:"total_settlement_minor"`
	IsBalanced                  bool                           `json:"is_balanced"`
	Payments                    []Payment                      `json:"payments"`
	Allocations                 []InvoiceAllocation            `json:"allocations"`
	Refunds                     []RefundRequest                `json:"refunds"`
	Credits                     []TenantCredit                 `json:"credits"`
}
