package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListExpensesUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewListExpensesUseCase(mockRepo)

		filter := finance.ExpenseFilter{Status: "approved"}
		expected := []finance.Expense{{ID: uuid.New(), PropertyID: propID, Title: "Water"}}

		mockRepo.On("ListExpenses", ctx, propID, filter).Return(expected, 1, nil)

		res, err := uc.Execute(ctx, usecase.ListExpensesInput{
			PropertyID: propID,
			Filter:     filter,
		})

		assert.NoError(t, err)
		assert.Equal(t, 1, res.Total)
		assert.Equal(t, expected, res.Expenses)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewListExpensesUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListExpensesInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
