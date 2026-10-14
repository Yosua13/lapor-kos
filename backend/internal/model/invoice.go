package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type BillingPolicy struct {
	ID                uuid.UUID `json:"id"`
	PropertyID        uuid.UUID `json:"property_id"`
	Timezone          string    `json:"timezone"`
	DueDay            int       `json:"due_day"`
	GenerateDaysBefore int      `json:"generate_days_before"`
	GenerationTime    string    `json:"generation_time"`
	InvalidDayPolicy  string    `json:"invalid_day_policy"`
	LateFeeEnabled    bool      `json:"late_fee_enabled"`
	LateFeeType       string    `json:"late_fee_type"`
	LateFeeValueMinor int64     `json:"late_fee_value_minor"`
	LateFeeGraceDays  int       `json:"late_fee_grace_days"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type Invoice struct {
	ID                  uuid.UUID       `json:"id"`
	PropertyID          uuid.UUID       `json:"property_id"`
	ContractID          uuid.UUID       `json:"contract_id"`
	TenantID            uuid.UUID       `json:"tenant_id"`
	SourceInvoiceID     *uuid.UUID      `json:"source_invoice_id,omitempty"`
	InvoiceNumber       string          `json:"invoice_number"`
	BillingPeriod       time.Time       `json:"billing_period"`
	InvoiceType         string          `json:"invoice_type"`
	Status              string          `json:"status"`
	Currency            string          `json:"currency"`
	DueAt               time.Time       `json:"due_at"`
	TotalMinor          int64           `json:"total_minor"`
	AllocatedMinor      int64           `json:"allocated_minor"`
	CreditAppliedMinor  int64           `json:"credit_applied_minor"`
	OutstandingMinor    int64           `json:"outstanding_minor"`
	CalculationSnapshot json.RawMessage `json:"calculation_snapshot"`
	IssuedAt            *time.Time      `json:"issued_at,omitempty"`
	CreatedAt           time.Time       `json:"created_at"`
	TenantName          string          `json:"tenant_name,omitempty"`
	RoomNumber          string          `json:"room_number,omitempty"`
	Items               []InvoiceItem   `json:"items,omitempty"`
	Events              []InvoiceEvent  `json:"events,omitempty"`
	Adjustments         []Invoice       `json:"adjustments,omitempty"`
}

type InvoiceItem struct {
	ID              uuid.UUID       `json:"id"`
	ItemType        string          `json:"item_type"`
	Description     string          `json:"description"`
	Quantity        string          `json:"quantity"`
	UnitAmountMinor int64           `json:"unit_amount_minor"`
	AmountMinor     int64           `json:"amount_minor"`
	Reason          string          `json:"reason"`
	Metadata        json.RawMessage `json:"metadata"`
	CreatedAt       time.Time       `json:"created_at"`
}

type InvoiceEvent struct {
	ID        uuid.UUID       `json:"id"`
	EventType string          `json:"event_type"`
	Reason    string          `json:"reason"`
	Metadata  json.RawMessage `json:"metadata"`
	ActorID   *uuid.UUID      `json:"actor_id,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

type InvoiceList struct {
	Items      []Invoice `json:"items"`
	Page       int       `json:"page"`
	PageSize   int       `json:"page_size"`
	TotalItems int       `json:"total_items"`
	TotalPages int       `json:"total_pages"`
}

type BillingJobResult struct {
	ID              uuid.UUID `json:"id"`
	PropertyID      uuid.UUID `json:"property_id"`
	BillingPeriod   time.Time `json:"billing_period"`
	Status          string    `json:"status"`
	ContractsSeen   int       `json:"contracts_seen"`
	InvoicesCreated int       `json:"invoices_created"`
	InvoicesSkipped int       `json:"invoices_skipped"`
	ErrorSummary    string    `json:"error_summary,omitempty"`
	StartedAt       time.Time `json:"started_at"`
	FinishedAt      *time.Time `json:"finished_at,omitempty"`
}

type MeterReadingRequest struct {
	ContractID    string  `json:"contract_id" binding:"required"`
	BillingPeriod string  `json:"billing_period" binding:"required"`
	UtilityType   string  `json:"utility_type" binding:"required"`
	PreviousValue float64 `json:"previous_value"`
	CurrentValue  float64 `json:"current_value"`
	UnitPriceMinor int64  `json:"unit_price_minor"`
	Notes         string  `json:"notes"`
}

type AdjustmentRequest struct {
	Description string `json:"description" binding:"required"`
	AmountMinor int64  `json:"amount_minor" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
}

type InvoiceAllocation struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	PropertyID  uuid.UUID  `json:"property_id" db:"property_id"`
	InvoiceID   uuid.UUID  `json:"invoice_id" db:"invoice_id"`
	PaymentID   *uuid.UUID `json:"payment_id,omitempty" db:"payment_id"`
	AmountMinor int64      `json:"amount_minor" db:"amount_minor"`
	Status      string     `json:"status" db:"status"` // valid, void
	Reason      string     `json:"reason" db:"reason"`
	CreatedBy   *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

