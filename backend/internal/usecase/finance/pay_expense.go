package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type PayExpenseInput struct {
	PropertyID    uuid.UUID
	ExpenseID     uuid.UUID
	ActorID       uuid.UUID
	PaymentMethod string
}

type PayExpenseUseCase struct {
	repo finance.Repository
}

func NewPayExpenseUseCase(repo finance.Repository) *PayExpenseUseCase {
	return &PayExpenseUseCase{repo: repo}
}

func (uc *PayExpenseUseCase) Execute(ctx context.Context, input PayExpenseInput) (*finance.Expense, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ExpenseID == uuid.Nil {
		return nil, errors.New("expense ID is required")
	}
	if input.PaymentMethod == "" {
		return nil, errors.New("payment method is required")
	}
	return uc.repo.PayExpense(ctx, input.PropertyID, input.ExpenseID, input.ActorID, input.PaymentMethod)
}
