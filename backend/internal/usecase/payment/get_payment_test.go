package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetPaymentUseCase(t *testing.T) {
	ctx := context.Background()
	payID := uuid.New()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success property access", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetPaymentUseCase(mockRepo)

		expected := &payment.Payment{ID: payID, PropertyID: propID}
		mockRepo.On("FindByID", ctx, payID, propID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetPaymentInput{
			ID:         payID,
			PropertyID: propID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant access", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetPaymentUseCase(mockRepo)

		expected := &payment.Payment{ID: payID, TenantID: &userID}
		mockRepo.On("FindByIDForUser", ctx, payID, userID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetPaymentInput{
			ID:       payID,
			UserID:   userID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing payment id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewGetPaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetPaymentInput{ID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
