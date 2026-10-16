package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type GetExpenseInput struct {
	PropertyID uuid.UUID
	ExpenseID  uuid.UUID
}

type GetExpenseUseCase struct {
	repo finance.Repository
}

func NewGetExpenseUseCase(repo finance.Repository) *GetExpenseUseCase {
	return &GetExpenseUseCase{repo: repo}
}

func (uc *GetExpenseUseCase) Execute(ctx context.Context, input GetExpenseInput) (*finance.Expense, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ExpenseID == uuid.Nil {
		return nil, errors.New("expense ID is required")
	}
	return uc.repo.GetExpenseByID(ctx, input.PropertyID, input.ExpenseID)
}
