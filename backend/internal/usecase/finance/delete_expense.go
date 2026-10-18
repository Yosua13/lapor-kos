package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type DeleteExpenseInput struct {
	PropertyID uuid.UUID
	ExpenseID  uuid.UUID
}

type DeleteExpenseUseCase struct {
	repo finance.Repository
}

func NewDeleteExpenseUseCase(repo finance.Repository) *DeleteExpenseUseCase {
	return &DeleteExpenseUseCase{repo: repo}
}

func (uc *DeleteExpenseUseCase) Execute(ctx context.Context, input DeleteExpenseInput) error {
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.ExpenseID == uuid.Nil {
		return errors.New("expense ID is required")
	}
	return uc.repo.DeleteExpense(ctx, input.PropertyID, input.ExpenseID)
}
