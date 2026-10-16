package checkout_test

import (
	"context"
	"testing"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCancelCheckoutUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	caseID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCancelCheckoutUseCase(mockRepo)

		mockRepo.On("CancelCheckout", ctx, propID, caseID, actorID, "Tenant renewed instead").Return(nil)

		err := uc.Execute(ctx, usecase.CancelCheckoutInput{
			PropertyID: propID,
			CheckoutID: caseID,
			ActorID:    actorID,
			Reason:     "Tenant renewed instead",
		})

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing reason", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCancelCheckoutUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.CancelCheckoutInput{
			PropertyID: propID,
			CheckoutID: caseID,
			Reason:     "",
		})
		assert.Error(t, err)
	})
}
