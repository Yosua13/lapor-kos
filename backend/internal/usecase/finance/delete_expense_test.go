package finance_test

import (
	"context"
	"testing"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestDeleteExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	expID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewDeleteExpenseUseCase(mockRepo)

		mockRepo.On("DeleteExpense", ctx, propID, expID).Return(nil)

		err := uc.Execute(ctx, usecase.DeleteExpenseInput{
			PropertyID: propID,
			ExpenseID:  expID,
		})

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing parameters", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewDeleteExpenseUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.DeleteExpenseInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
	})
}
