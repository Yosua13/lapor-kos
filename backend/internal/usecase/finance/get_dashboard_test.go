package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetDashboardUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetDashboardUseCase(mockRepo)

		expected := &finance.FinancialDashboardSummary{
			PropertyID:        propID,
			Currency:          "IDR",
			CashReceivedMinor: 5000000,
		}
		mockRepo.On("GetFinancialDashboard", ctx, propID, "2026-10-01", "2026-10-31").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetDashboardInput{
			PropertyID:  propID,
			PeriodStart: "2026-10-01",
			PeriodEnd:   "2026-10-31",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewGetDashboardUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetDashboardInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
