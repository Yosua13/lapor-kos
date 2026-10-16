package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestApproveExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	expID := uuid.New()
	approverID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewApproveExpenseUseCase(mockRepo)

		expected := &finance.Expense{ID: expID, PropertyID: propID, Status: "approved"}
		mockRepo.On("ApproveExpense", ctx, propID, expID, approverID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ApproveExpenseInput{
			PropertyID: propID,
			ExpenseID:  expID,
			ApproverID: approverID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewApproveExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ApproveExpenseInput{PropertyID: uuid.Nil, ExpenseID: expID})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
