package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListPeriodClosuresUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewListPeriodClosuresUseCase(mockRepo)

		expected := []finance.FinancePeriodClosure{{ID: uuid.New(), PropertyID: propID, PeriodKey: "2026-09"}}
		mockRepo.On("ListPeriodClosures", ctx, propID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListPeriodClosuresInput{PropertyID: propID})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewListPeriodClosuresUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListPeriodClosuresInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
