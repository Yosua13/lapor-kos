package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ApproveExpenseInput struct {
	PropertyID uuid.UUID
	ExpenseID  uuid.UUID
	ApproverID uuid.UUID
}

type ApproveExpenseUseCase struct {
	repo finance.Repository
}

func NewApproveExpenseUseCase(repo finance.Repository) *ApproveExpenseUseCase {
	return &ApproveExpenseUseCase{repo: repo}
}

func (uc *ApproveExpenseUseCase) Execute(ctx context.Context, input ApproveExpenseInput) (*finance.Expense, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ExpenseID == uuid.Nil {
		return nil, errors.New("expense ID is required")
	}
	return uc.repo.ApproveExpense(ctx, input.PropertyID, input.ExpenseID, input.ApproverID)
}
