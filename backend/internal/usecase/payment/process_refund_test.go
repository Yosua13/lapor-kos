package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestProcessRefundUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	refundID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewProcessRefundUseCase(mockRepo)

		req := payment.ProcessRefundPayload{Status: "approved", DisbursementRef: "REF-12345"}
		expected := &payment.RefundRequest{ID: refundID, PropertyID: propID, Status: "approved"}
		mockRepo.On("ProcessRefund", ctx, propID, actorID, refundID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ProcessRefundInput{
			PropertyID: propID,
			ActorID:    actorID,
			RefundID:   refundID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewProcessRefundUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ProcessRefundInput{
			PropertyID: uuid.Nil,
			RefundID:   refundID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing refund id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewProcessRefundUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ProcessRefundInput{
			PropertyID: propID,
			RefundID:   uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
