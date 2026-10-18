package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type UpdateExpenseInput struct {
	PropertyID uuid.UUID
	ExpenseID  uuid.UUID
	ActorID    uuid.UUID
	Request    finance.UpdateExpenseRequest
}

type UpdateExpenseUseCase struct {
	repo finance.Repository
}

func NewUpdateExpenseUseCase(repo finance.Repository) *UpdateExpenseUseCase {
	return &UpdateExpenseUseCase{repo: repo}
}

func (uc *UpdateExpenseUseCase) Execute(ctx context.Context, input UpdateExpenseInput) (*finance.Expense, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ExpenseID == uuid.Nil {
		return nil, errors.New("expense ID is required")
	}
	return uc.repo.UpdateExpense(ctx, input.PropertyID, input.ExpenseID, input.ActorID, input.Request)
}
