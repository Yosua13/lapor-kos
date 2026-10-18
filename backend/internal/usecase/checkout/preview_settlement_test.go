package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestPreviewSettlementUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	caseID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewPreviewSettlementUseCase(mockRepo)

		expected := &checkout.SettlementCalculation{DepositHeldMinor: 500000, NetSettlementMinor: 300000}
		mockRepo.On("PreviewSettlement", ctx, propID, caseID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.PreviewSettlementInput{
			PropertyID: propID,
			CheckoutID: caseID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewPreviewSettlementUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PreviewSettlementInput{
			PropertyID: uuid.Nil,
			CheckoutID: caseID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing case id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewPreviewSettlementUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PreviewSettlementInput{
			PropertyID: propID,
			CheckoutID: uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
