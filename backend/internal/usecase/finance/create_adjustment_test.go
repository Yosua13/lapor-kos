package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreateAdjustmentUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	reqByID := uuid.New()
	closeID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateAdjustmentUseCase(mockRepo)

		req := finance.CreatePeriodAdjustmentRequest{
			AmountMinor: 50000,
			Reason:      "Missed meter expense",
		}
		expected := &finance.FinancePeriodAdjustment{ID: uuid.New(), PropertyID: propID, AmountMinor: 50000}
		mockRepo.On("CreateAdjustment", ctx, propID, reqByID, closeID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.CreateAdjustmentInput{
			PropertyID:    propID,
			RequestedByID: reqByID,
			PeriodCloseID: closeID,
			Request:       req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("zero amount", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateAdjustmentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateAdjustmentInput{
			PropertyID:    propID,
			PeriodCloseID: closeID,
			Request:       finance.CreatePeriodAdjustmentRequest{AmountMinor: 0},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
