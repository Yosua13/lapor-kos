package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestClosePeriodUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	closedByID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewClosePeriodUseCase(mockRepo)

		req := finance.ClosePeriodRequest{PeriodKey: "2026-10", Notes: "Month end close"}
		expected := &finance.FinancePeriodClosure{ID: uuid.New(), PropertyID: propID, PeriodKey: "2026-10", Status: "closed"}
		mockRepo.On("ClosePeriod", ctx, propID, closedByID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ClosePeriodInput{
			PropertyID: propID,
			ClosedByID: closedByID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing period key", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewClosePeriodUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ClosePeriodInput{
			PropertyID: propID,
			ClosedByID: closedByID,
			Request:    finance.ClosePeriodRequest{PeriodKey: ""},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
