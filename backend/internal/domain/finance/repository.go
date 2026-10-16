package finance

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the persistence interface for the Finance domain.
type Repository interface {
	GetFinancialDashboard(ctx context.Context, propertyID uuid.UUID, periodStart, periodEnd string) (*FinancialDashboardSummary, error)
	GetReceivablesAging(ctx context.Context, propertyID uuid.UUID) (*ReceivablesAgingSummary, error)
	ListExpenses(ctx context.Context, propertyID uuid.UUID, filter ExpenseFilter) ([]Expense, int, error)
	GetExpenseByID(ctx context.Context, propertyID, expenseID uuid.UUID) (*Expense, error)
	CreateExpense(ctx context.Context, propertyID, creatorID uuid.UUID, req CreateExpenseRequest) (*Expense, error)
	UpdateExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, req UpdateExpenseRequest) (*Expense, error)
	ApproveExpense(ctx context.Context, propertyID, expenseID, approverID uuid.UUID) (*Expense, error)
	PayExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, paymentMethod string) (*Expense, error)
	DeleteExpense(ctx context.Context, propertyID, expenseID uuid.UUID) error
	GetPeriodClosure(ctx context.Context, propertyID uuid.UUID, periodKey string) (*FinancePeriodClosure, error)
	ListPeriodClosures(ctx context.Context, propertyID uuid.UUID) ([]FinancePeriodClosure, error)
	ClosePeriod(ctx context.Context, propertyID, closedByID uuid.UUID, req ClosePeriodRequest) (*FinancePeriodClosure, error)
	ReopenPeriod(ctx context.Context, propertyID, reopenedByID uuid.UUID, periodKey string, req ReopenPeriodRequest) (*FinancePeriodClosure, error)
	CreateAdjustment(ctx context.Context, propertyID, requestedByID, periodCloseID uuid.UUID, req CreatePeriodAdjustmentRequest) (*FinancePeriodAdjustment, error)
	ListAdjustments(ctx context.Context, propertyID uuid.UUID, periodCloseID *uuid.UUID) ([]FinancePeriodAdjustment, error)
	GetAdjustmentByID(ctx context.Context, propertyID, adjustmentID uuid.UUID) (*FinancePeriodAdjustment, error)
	ApproveAdjustment(ctx context.Context, propertyID, adjustmentID, approverID uuid.UUID, req ApproveAdjustmentRequest) (*FinancePeriodAdjustment, error)
}
