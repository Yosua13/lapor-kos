package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetPeriodClosureUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetPeriodClosureUseCase(mockRepo)

		expected := &finance.FinancePeriodClosure{ID: uuid.New(), PropertyID: propID, PeriodKey: "2026-10", Status: "closed"}
		mockRepo.On("GetPeriodClosure", ctx, propID, "2026-10").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetPeriodClosureInput{
			PropertyID: propID,
			PeriodKey:  "2026-10",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing period key", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetPeriodClosureUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetPeriodClosureInput{PropertyID: propID, PeriodKey: ""})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
