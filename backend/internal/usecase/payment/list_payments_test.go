package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListPaymentsUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success property payments", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewListPaymentsUseCase(mockRepo)

		expected := []payment.Payment{{ID: uuid.New(), PropertyID: propID}}
		mockRepo.On("FindAll", ctx, propID, "paid", 10, 2026, "", "").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListPaymentsInput{
			PropertyID: propID,
			Status:     "paid",
			Month:      10,
			Year:       2026,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant payments", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewListPaymentsUseCase(mockRepo)

		expected := []payment.Payment{{ID: uuid.New(), TenantID: &userID}}
		mockRepo.On("FindByUserID", ctx, userID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListPaymentsInput{
			UserID:   userID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewListPaymentsUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListPaymentsInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
