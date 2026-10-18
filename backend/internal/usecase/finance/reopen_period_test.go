package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestReopenPeriodUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	reopenedByID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewReopenPeriodUseCase(mockRepo)

		req := finance.ReopenPeriodRequest{Reason: "Late invoice adjustment"}
		expected := &finance.FinancePeriodClosure{ID: uuid.New(), PropertyID: propID, PeriodKey: "2026-10", Status: "reopened"}
		mockRepo.On("ReopenPeriod", ctx, propID, reopenedByID, "2026-10", req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ReopenPeriodInput{
			PropertyID:   propID,
			ReopenedByID: reopenedByID,
			PeriodKey:    "2026-10",
			Request:      req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing reason", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewReopenPeriodUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ReopenPeriodInput{
			PropertyID:   propID,
			ReopenedByID: reopenedByID,
			PeriodKey:    "2026-10",
			Request:      finance.ReopenPeriodRequest{Reason: ""},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
