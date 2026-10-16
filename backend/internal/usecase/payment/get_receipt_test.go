package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetReceiptUseCase(t *testing.T) {
	ctx := context.Background()
	payID := uuid.New()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success property receipt", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetReceiptUseCase(mockRepo)

		expected := &payment.PaymentReceipt{ID: uuid.New(), PaymentID: payID, PropertyID: propID}
		mockRepo.On("GetReceipt", ctx, propID, payID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetReceiptInput{
			PaymentID:  payID,
			PropertyID: propID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant receipt", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetReceiptUseCase(mockRepo)

		expected := &payment.PaymentReceipt{ID: uuid.New(), PaymentID: payID, TenantID: userID}
		mockRepo.On("GetReceiptForUser", ctx, userID, payID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetReceiptInput{
			PaymentID: payID,
			UserID:    userID,
			IsTenant:  true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})
}
