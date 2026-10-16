package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetReconciliationUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetReconciliationUseCase(mockRepo)

		expected := &payment.ReconciliationReport{PropertyID: propID, TotalPaymentsReceivedMinor: 3000000}
		mockRepo.On("GetReconciliationReport", ctx, propID, "2026-10-01", "2026-10-31").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetReconciliationInput{
			PropertyID: propID,
			StartDate:  "2026-10-01",
			EndDate:    "2026-10-31",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetReconciliationUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetReconciliationInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
