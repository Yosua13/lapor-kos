package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestExecuteCheckoutUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	caseID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewExecuteCheckoutUseCase(mockRepo)

		req := checkout.ExecuteCheckoutRequest{TargetRoomStatus: "cleaning"}
		expected := &checkout.CheckoutCase{ID: caseID, PropertyID: propID, Status: "completed"}
		mockRepo.On("ExecuteCheckout", ctx, propID, caseID, actorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ExecuteCheckoutInput{
			PropertyID: propID,
			CheckoutID: caseID,
			ActorID:    actorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing case id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewExecuteCheckoutUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ExecuteCheckoutInput{
			PropertyID: propID,
			CheckoutID: uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
