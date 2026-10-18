package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestVerifyPaymentUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	payID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewVerifyPaymentUseCase(mockRepo)

		req := payment.VerifyPaymentRequest{PaidAmountMinor: 1500000}
		expected := &payment.Payment{ID: payID, PropertyID: propID, Status: "verified"}
		mockRepo.On("VerifyPaymentTx", ctx, propID, actorID, payID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.VerifyPaymentInput{
			PropertyID: propID,
			ActorID:    actorID,
			PaymentID:  payID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewVerifyPaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.VerifyPaymentInput{
			PropertyID: uuid.Nil,
			PaymentID:  payID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing payment id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewVerifyPaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.VerifyPaymentInput{
			PropertyID: propID,
			PaymentID:  uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
