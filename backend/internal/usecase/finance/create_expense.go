package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type CreateExpenseInput struct {
	PropertyID uuid.UUID
	CreatorID  uuid.UUID
	Request    finance.CreateExpenseRequest
}

type CreateExpenseUseCase struct {
	repo finance.Repository
}

func NewCreateExpenseUseCase(repo finance.Repository) *CreateExpenseUseCase {
	return &CreateExpenseUseCase{repo: repo}
}

func (uc *CreateExpenseUseCase) Execute(ctx context.Context, input CreateExpenseInput) (*finance.Expense, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.AmountMinor <= 0 {
		return nil, errors.New("expense amount must be greater than zero")
	}
	if input.Request.Title == "" {
		return nil, errors.New("expense title is required")
	}
	return uc.repo.CreateExpense(ctx, input.PropertyID, input.CreatorID, input.Request)
}
