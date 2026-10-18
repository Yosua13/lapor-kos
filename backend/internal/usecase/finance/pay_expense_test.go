package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestPayExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	expID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewPayExpenseUseCase(mockRepo)

		expected := &finance.Expense{ID: expID, PropertyID: propID, Status: "paid", PaymentMethod: "bank_transfer"}
		mockRepo.On("PayExpense", ctx, propID, expID, actorID, "bank_transfer").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.PayExpenseInput{
			PropertyID:    propID,
			ExpenseID:     expID,
			ActorID:       actorID,
			PaymentMethod: "bank_transfer",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing payment method", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewPayExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PayExpenseInput{
			PropertyID: propID,
			ExpenseID:  expID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
