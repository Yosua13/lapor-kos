package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	expID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetExpenseUseCase(mockRepo)

		expected := &finance.Expense{
			ID:         expID,
			PropertyID: propID,
			Title:      "Electricity Bill",
		}

		mockRepo.On("GetExpenseByID", ctx, propID, expID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetExpenseInput{
			PropertyID: propID,
			ExpenseID:  expID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetExpenseInput{
			PropertyID: uuid.Nil,
			ExpenseID:  expID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing expense id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetExpenseInput{
			PropertyID: propID,
			ExpenseID:  uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
