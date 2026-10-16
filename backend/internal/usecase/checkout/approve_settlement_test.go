package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestApproveSettlementUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	caseID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewApproveSettlementUseCase(mockRepo)

		expected := &checkout.CheckoutCase{ID: caseID, PropertyID: propID, Status: "approved"}
		mockRepo.On("ApproveSettlement", ctx, propID, caseID, actorID, "Settlement approved").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ApproveSettlementInput{
			PropertyID: propID,
			CheckoutID: caseID,
			ActorID:    actorID,
			Notes:      "Settlement approved",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing case id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewApproveSettlementUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ApproveSettlementInput{
			PropertyID: propID,
			CheckoutID: uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
