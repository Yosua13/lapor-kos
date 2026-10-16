package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Expense represents an operational expense item for a property.
type Expense struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	PropertyID        uuid.UUID  `json:"property_id" db:"property_id"`
	ExpenseNumber     string     `json:"expense_number" db:"expense_number"`
	Category          string     `json:"category" db:"category"`
	VendorID          *uuid.UUID `json:"vendor_id,omitempty" db:"vendor_id"`
	VendorName        string     `json:"vendor_name" db:"vendor_name"`
	Title             string     `json:"title" db:"title"`
	Description       string     `json:"description" db:"description"`
	AmountMinor       int64      `json:"amount_minor" db:"amount_minor"`
	Currency          string     `json:"currency" db:"currency"`
	ExpenseDate       string     `json:"expense_date" db:"expense_date"`
	Status            string     `json:"status" db:"status"` // draft, pending_approval, approved, rejected, paid, cancelled
	PaymentMethod     string     `json:"payment_method" db:"payment_method"`
	ProofFileID       *uuid.UUID `json:"proof_file_id,omitempty" db:"proof_file_id"`
	ProofFileURL      string     `json:"proof_file_url,omitempty" db:"proof_file_url"`
	IsRecurring       bool       `json:"is_recurring" db:"is_recurring"`
	RecurringInterval *string    `json:"recurring_interval,omitempty" db:"recurring_interval"`
	CreatedBy         *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	ApprovedBy        *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedAt        *time.Time `json:"approved_at,omitempty" db:"approved_at"`
	PaidAt            *time.Time `json:"paid_at,omitempty" db:"paid_at"`
	RejectionReason   string     `json:"rejection_reason" db:"rejection_reason"`
	PeriodCloseID     *uuid.UUID `json:"period_close_id,omitempty" db:"period_close_id"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at" db:"updated_at"`

	// Joined fields
	CreatedByName  string `json:"created_by_name,omitempty" db:"created_by_name"`
	ApprovedByName string `json:"approved_by_name,omitempty" db:"approved_by_name"`
}

// FinancePeriodClosure locks a monthly accounting period for audit integrity.
type FinancePeriodClosure struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	PropertyID      uuid.UUID       `json:"property_id" db:"property_id"`
	PeriodKey       string          `json:"period_key" db:"period_key"` // 'YYYY-MM'
	PeriodStart     string          `json:"period_start" db:"period_start"`
	PeriodEnd       string          `json:"period_end" db:"period_end"`
	Status          string          `json:"status" db:"status"` // closed, locked, reopened
	ClosedBy        uuid.UUID       `json:"closed_by" db:"closed_by"`
	ClosedByName    string          `json:"closed_by_name,omitempty" db:"closed_by_name"`
	ClosedAt        time.Time       `json:"closed_at" db:"closed_at"`
	ReopenedBy      *uuid.UUID      `json:"reopened_by,omitempty" db:"reopened_by"`
	ReopenedByName  string          `json:"reopened_by_name,omitempty" db:"reopened_by_name"`
	ReopenedAt      *time.Time      `json:"reopened_at,omitempty" db:"reopened_at"`
	ReopenReason    string          `json:"reopen_reason" db:"reopen_reason"`
	SummarySnapshot json.RawMessage `json:"summary_snapshot" db:"summary_snapshot"`
	Notes           string          `json:"notes" db:"notes"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`

	Adjustments []FinancePeriodAdjustment `json:"adjustments,omitempty"`
}

// FinancePeriodAdjustment tracks post-closure adjustments with strict approval.
type FinancePeriodAdjustment struct {
	ID               uuid.UUID  `json:"id" db:"id"`
	PropertyID       uuid.UUID  `json:"property_id" db:"property_id"`
	PeriodCloseID    uuid.UUID  `json:"period_close_id" db:"period_close_id"`
	AdjustmentNumber string     `json:"adjustment_number" db:"adjustment_number"`
	AdjustmentType   string     `json:"adjustment_type" db:"adjustment_type"` // expense_adjustment, revenue_correction, deposit_adjustment, write_off, other
	AmountMinor      int64      `json:"amount_minor" db:"amount_minor"`
	Reason           string     `json:"reason" db:"reason"`
	Status           string     `json:"status" db:"status"` // pending, approved, rejected
	RequestedBy      uuid.UUID  `json:"requested_by" db:"requested_by"`
	RequestedByName  string     `json:"requested_by_name,omitempty" db:"requested_by_name"`
	ApprovedBy       *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	ApprovedByName   string     `json:"approved_by_name,omitempty" db:"approved_by_name"`
	ApprovedAt       *time.Time `json:"approved_at,omitempty" db:"approved_at"`
	RejectionReason  string     `json:"rejection_reason" db:"rejection_reason"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`

	Events []FinancePeriodAdjustmentEvent `json:"events,omitempty"`
}

// FinancePeriodAdjustmentEvent represents an audit event for adjustment approvals.
type FinancePeriodAdjustmentEvent struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	AdjustmentID   uuid.UUID  `json:"adjustment_id" db:"adjustment_id"`
	PropertyID     uuid.UUID  `json:"property_id" db:"property_id"`
	ActorID        *uuid.UUID `json:"actor_id,omitempty" db:"actor_id"`
	ActorName      string     `json:"actor_name,omitempty" db:"actor_name"`
	EventType      string     `json:"event_type" db:"event_type"` // requested, approved, rejected, note_added
	PreviousStatus string     `json:"previous_status" db:"previous_status"`
	NewStatus      string     `json:"new_status" db:"new_status"`
	Notes          string     `json:"notes" db:"notes"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

// FinanceExportJob tracks asynchronous or background report exports.
type FinanceExportJob struct {
	ID              uuid.UUID       `json:"id" db:"id"`
	PropertyID      uuid.UUID       `json:"property_id" db:"property_id"`
	RequestedBy     uuid.UUID       `json:"requested_by" db:"requested_by"`
	RequestedByName string          `json:"requested_by_name,omitempty" db:"requested_by_name"`
	ReportType      string          `json:"report_type" db:"report_type"` // cash_flow, receivables_aging, expense_summary, income_statement, full_ledger
	PeriodStart     string          `json:"period_start" db:"period_start"`
	PeriodEnd       string          `json:"period_end" db:"period_end"`
	ExportFormat    string          `json:"export_format" db:"export_format"` // csv, pdf
	Status          string          `json:"status" db:"status"`               // pending, processing, completed, failed
	FileName        string          `json:"file_name" db:"file_name"`
	FileContent     string          `json:"file_content,omitempty" db:"file_content"`
	TotalRows       int             `json:"total_rows" db:"total_rows"`
	ChecksumSHA256  string          `json:"checksum_sha256" db:"checksum_sha256"`
	ErrorMessage    string          `json:"error_message" db:"error_message"`
	Metadata        json.RawMessage `json:"metadata" db:"metadata"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty" db:"completed_at"`
}

// FinancialDashboardSummary provides aggregated executive reconciliation metrics.
type FinancialDashboardSummary struct {
	PropertyID             uuid.UUID                 `json:"property_id"`
	PropertyName           string                    `json:"property_name"`
	Currency               string                    `json:"currency"`
	PeriodStart            string                    `json:"period_start"`
	PeriodEnd              string                    `json:"period_end"`
	IsPeriodClosed         bool                      `json:"is_period_closed"`
	PeriodClosure          *FinancePeriodClosure     `json:"period_closure,omitempty"`
	CashReceivedMinor      int64                     `json:"cash_received_minor"`      // Verified payments only
	PendingPaymentsMinor   int64                     `json:"pending_payments_minor"`    // Unverified / pending cash
	DepositLiabilityMinor  int64                     `json:"deposit_liability_minor"`   // Held deposits (liabilities, NOT revenue)
	BilledRevenueMinor     int64                     `json:"billed_revenue_minor"`      // Invoiced rent and utilities
	OperatingExpensesMinor int64                     `json:"operating_expenses_minor"`  // Approved / paid expenses
	NetOperatingIncomeMinor int64                    `json:"net_operating_income_minor"` // Cash Received - Expenses Paid
	AccrualNetIncomeMinor  int64                     `json:"accrual_net_income_minor"`  // Billed Revenue - Recorded Expenses
	TotalReceivableMinor   int64                     `json:"total_receivable_minor"`    // Outstanding issued invoices
	ReceivablesAging       ReceivablesAgingSummary   `json:"receivables_aging"`
	ExpensesByCategory     []CategoryExpenseSummary  `json:"expenses_by_category"`
	OccupancyStats         OccupancyFinancialStats   `json:"occupancy_stats"`
}

// ReceivablesAgingSummary aggregates invoice debt by aging buckets.
type ReceivablesAgingSummary struct {
	CurrentMinor          int64              `json:"current_minor"`           // <= 30 days
	Due31To60Minor        int64              `json:"due_31_to_60_minor"`      // 31 - 60 days
	Due61To90Minor        int64              `json:"due_61_to_90_minor"`      // 61 - 90 days
	Overdue90PlusMinor    int64              `json:"overdue_90_plus_minor"`   // > 90 days
	TotalOutstandingMinor int64              `json:"total_outstanding_minor"`
	Invoices              []AgingInvoiceItem `json:"invoices"`
}

// AgingInvoiceItem contains individual invoice aging details.
type AgingInvoiceItem struct {
	InvoiceID        uuid.UUID `json:"invoice_id"`
	InvoiceNumber    string    `json:"invoice_number"`
	TenantName       string    `json:"tenant_name"`
	RoomNumber       string    `json:"room_number"`
	DueAt            time.Time `json:"due_at"`
	DaysPastDue      int       `json:"days_past_due"`
	TotalMinor       int64     `json:"total_minor"`
	OutstandingMinor int64     `json:"outstanding_minor"`
	AgingBucket      string    `json:"aging_bucket"` // current, 31_60, 61_90, 90_plus
}

// CategoryExpenseSummary breaks down expenses by category.
type CategoryExpenseSummary struct {
	Category      string  `json:"category"`
	CategoryLabel string  `json:"category_label"`
	TotalMinor    int64   `json:"total_minor"`
	Count         int     `json:"count"`
	Percentage    float64 `json:"percentage"`
}

// OccupancyFinancialStats computes current room occupancy impact.
type OccupancyFinancialStats struct {
	TotalRooms                   int     `json:"total_rooms"`
	OccupiedRooms                int     `json:"occupied_rooms"`
	AvailableRooms               int     `json:"available_rooms"`
	OccupancyRate                float64 `json:"occupancy_rate"`
	PotentialMonthlyRevenueMinor int64   `json:"potential_monthly_revenue_minor"`
	ActualMonthlyRevenueMinor    int64   `json:"actual_monthly_revenue_minor"`
}

// ExpenseFilter options for querying expenses with pagination.
type ExpenseFilter struct {
	Category  string `form:"category"`
	Status    string `form:"status"`
	VendorID  string `form:"vendor_id"`
	StartDate string `form:"start_date"`
	EndDate   string `form:"end_date"`
	Search    string `form:"search"`
	Page      int    `form:"page"`
	PageSize  int    `form:"page_size"`
}

// CreateExpenseRequest payload.
type CreateExpenseRequest struct {
	Category          string `json:"category" binding:"required"`
	VendorID          string `json:"vendor_id"`
	VendorName        string `json:"vendor_name"`
	Title             string `json:"title" binding:"required"`
	Description       string `json:"description"`
	AmountMinor       int64  `json:"amount_minor" binding:"required,gt=0"`
	ExpenseDate       string `json:"expense_date" binding:"required"`
	PaymentMethod     string `json:"payment_method"`
	ProofFileID       string `json:"proof_file_id"`
	IsRecurring       bool   `json:"is_recurring"`
	RecurringInterval string `json:"recurring_interval"`
	Status            string `json:"status"` // 'draft', 'pending_approval', 'approved', 'paid'
}

// UpdateExpenseRequest payload.
type UpdateExpenseRequest struct {
	Category          string `json:"category"`
	VendorID          string `json:"vendor_id"`
	VendorName        string `json:"vendor_name"`
	Title             string `json:"title"`
	Description       string `json:"description"`
	AmountMinor       int64  `json:"amount_minor"`
	ExpenseDate       string `json:"expense_date"`
	PaymentMethod     string `json:"payment_method"`
	ProofFileID       string `json:"proof_file_id"`
	IsRecurring       bool   `json:"is_recurring"`
	RecurringInterval string `json:"recurring_interval"`
	Status            string `json:"status"`
}

// ClosePeriodRequest payload.
type ClosePeriodRequest struct {
	PeriodKey string `json:"period_key" binding:"required"` // 'YYYY-MM'
	Notes     string `json:"notes"`
}

// ReopenPeriodRequest payload.
type ReopenPeriodRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// CreatePeriodAdjustmentRequest payload.
type CreatePeriodAdjustmentRequest struct {
	AdjustmentType string `json:"adjustment_type" binding:"required"` // expense_adjustment, revenue_correction, deposit_adjustment, write_off, other
	AmountMinor    int64  `json:"amount_minor" binding:"required"`
	Reason         string `json:"reason" binding:"required"`
}

// ApproveAdjustmentRequest payload.
type ApproveAdjustmentRequest struct {
	Approved        bool   `json:"approved"`
	RejectionReason string `json:"rejection_reason"`
	Notes           string `json:"notes"`
}

// CreateExportJobRequest payload.
type CreateExportJobRequest struct {
	ReportType   string `json:"report_type" binding:"required"` // cash_flow, receivables_aging, expense_summary, income_statement, full_ledger
	PeriodStart  string `json:"period_start" binding:"required"`
	PeriodEnd    string `json:"period_end" binding:"required"`
	ExportFormat string `json:"export_format"` // default 'csv'
}
