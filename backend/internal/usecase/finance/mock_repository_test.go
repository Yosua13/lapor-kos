package finance_test

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockFinanceRepository struct {
	mock.Mock
}

func (m *MockFinanceRepository) GetFinancialDashboard(ctx context.Context, propertyID uuid.UUID, periodStart, periodEnd string) (*finance.FinancialDashboardSummary, error) {
	args := m.Called(ctx, propertyID, periodStart, periodEnd)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancialDashboardSummary), args.Error(1)
}

func (m *MockFinanceRepository) GetReceivablesAging(ctx context.Context, propertyID uuid.UUID) (*finance.ReceivablesAgingSummary, error) {
	args := m.Called(ctx, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.ReceivablesAgingSummary), args.Error(1)
}

func (m *MockFinanceRepository) ListExpenses(ctx context.Context, propertyID uuid.UUID, filter finance.ExpenseFilter) ([]finance.Expense, int, error) {
	args := m.Called(ctx, propertyID, filter)
	return args.Get(0).([]finance.Expense), args.Int(1), args.Error(2)
}

func (m *MockFinanceRepository) GetExpenseByID(ctx context.Context, propertyID, expenseID uuid.UUID) (*finance.Expense, error) {
	args := m.Called(ctx, propertyID, expenseID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.Expense), args.Error(1)
}

func (m *MockFinanceRepository) CreateExpense(ctx context.Context, propertyID, creatorID uuid.UUID, req finance.CreateExpenseRequest) (*finance.Expense, error) {
	args := m.Called(ctx, propertyID, creatorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.Expense), args.Error(1)
}

func (m *MockFinanceRepository) UpdateExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, req finance.UpdateExpenseRequest) (*finance.Expense, error) {
	args := m.Called(ctx, propertyID, expenseID, actorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.Expense), args.Error(1)
}

func (m *MockFinanceRepository) ApproveExpense(ctx context.Context, propertyID, expenseID, approverID uuid.UUID) (*finance.Expense, error) {
	args := m.Called(ctx, propertyID, expenseID, approverID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.Expense), args.Error(1)
}

func (m *MockFinanceRepository) PayExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, paymentMethod string) (*finance.Expense, error) {
	args := m.Called(ctx, propertyID, expenseID, actorID, paymentMethod)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.Expense), args.Error(1)
}

func (m *MockFinanceRepository) DeleteExpense(ctx context.Context, propertyID, expenseID uuid.UUID) error {
	args := m.Called(ctx, propertyID, expenseID)
	return args.Error(0)
}

func (m *MockFinanceRepository) GetPeriodClosure(ctx context.Context, propertyID uuid.UUID, periodKey string) (*finance.FinancePeriodClosure, error) {
	args := m.Called(ctx, propertyID, periodKey)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodClosure), args.Error(1)
}

func (m *MockFinanceRepository) ListPeriodClosures(ctx context.Context, propertyID uuid.UUID) ([]finance.FinancePeriodClosure, error) {
	args := m.Called(ctx, propertyID)
	return args.Get(0).([]finance.FinancePeriodClosure), args.Error(1)
}

func (m *MockFinanceRepository) ClosePeriod(ctx context.Context, propertyID, closedByID uuid.UUID, req finance.ClosePeriodRequest) (*finance.FinancePeriodClosure, error) {
	args := m.Called(ctx, propertyID, closedByID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodClosure), args.Error(1)
}

func (m *MockFinanceRepository) ReopenPeriod(ctx context.Context, propertyID, reopenedByID uuid.UUID, periodKey string, req finance.ReopenPeriodRequest) (*finance.FinancePeriodClosure, error) {
	args := m.Called(ctx, propertyID, reopenedByID, periodKey, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodClosure), args.Error(1)
}

func (m *MockFinanceRepository) CreateAdjustment(ctx context.Context, propertyID, requestedByID, periodCloseID uuid.UUID, req finance.CreatePeriodAdjustmentRequest) (*finance.FinancePeriodAdjustment, error) {
	args := m.Called(ctx, propertyID, requestedByID, periodCloseID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodAdjustment), args.Error(1)
}

func (m *MockFinanceRepository) ListAdjustments(ctx context.Context, propertyID uuid.UUID, periodCloseID *uuid.UUID) ([]finance.FinancePeriodAdjustment, error) {
	args := m.Called(ctx, propertyID, periodCloseID)
	return args.Get(0).([]finance.FinancePeriodAdjustment), args.Error(1)
}

func (m *MockFinanceRepository) GetAdjustmentByID(ctx context.Context, propertyID, adjustmentID uuid.UUID) (*finance.FinancePeriodAdjustment, error) {
	args := m.Called(ctx, propertyID, adjustmentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodAdjustment), args.Error(1)
}

func (m *MockFinanceRepository) ApproveAdjustment(ctx context.Context, propertyID, adjustmentID, approverID uuid.UUID, req finance.ApproveAdjustmentRequest) (*finance.FinancePeriodAdjustment, error) {
	args := m.Called(ctx, propertyID, adjustmentID, approverID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*finance.FinancePeriodAdjustment), args.Error(1)
}
