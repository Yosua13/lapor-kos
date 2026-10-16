package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUpdateExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	expID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewUpdateExpenseUseCase(mockRepo)

		title := "Updated Internet"
		req := finance.UpdateExpenseRequest{Title: title}
		expected := &finance.Expense{ID: expID, PropertyID: propID, Title: title}

		mockRepo.On("UpdateExpense", ctx, propID, expID, actorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.UpdateExpenseInput{
			PropertyID: propID,
			ExpenseID:  expID,
			ActorID:    actorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing parameters", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewUpdateExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.UpdateExpenseInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)

		res, err = uc.Execute(ctx, usecase.UpdateExpenseInput{PropertyID: propID, ExpenseID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
