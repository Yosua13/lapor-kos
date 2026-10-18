package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreateRefundUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	payID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreateRefundUseCase(mockRepo)

		req := payment.CreateRefundRequestPayload{
			PaymentID:   payID,
			AmountMinor: 500000,
			Reason:      "Overpayment",
		}
		expected := &payment.RefundRequest{ID: uuid.New(), PropertyID: propID, PaymentID: payID, AmountMinor: 500000}
		mockRepo.On("CreateRefund", ctx, propID, actorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.CreateRefundInput{
			PropertyID: propID,
			ActorID:    actorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("zero amount", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreateRefundUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateRefundInput{
			PropertyID: propID,
			Request: payment.CreateRefundRequestPayload{
				PaymentID:   payID,
				AmountMinor: 0,
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
