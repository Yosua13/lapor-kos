package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ListExpensesInput struct {
	PropertyID uuid.UUID
	Filter     finance.ExpenseFilter
}

type ListExpensesOutput struct {
	Expenses []finance.Expense
	Total    int
}

type ListExpensesUseCase struct {
	repo finance.Repository
}

func NewListExpensesUseCase(repo finance.Repository) *ListExpensesUseCase {
	return &ListExpensesUseCase{repo: repo}
}

func (uc *ListExpensesUseCase) Execute(ctx context.Context, input ListExpensesInput) (*ListExpensesOutput, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	expenses, total, err := uc.repo.ListExpenses(ctx, input.PropertyID, input.Filter)
	if err != nil {
		return nil, err
	}
	return &ListExpensesOutput{Expenses: expenses, Total: total}, nil
}
