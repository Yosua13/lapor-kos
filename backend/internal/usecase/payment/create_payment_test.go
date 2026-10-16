package payment_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreatePaymentUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	contractID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreatePaymentUseCase(mockRepo)

		p := &payment.Payment{
			PropertyID:  propID,
			ContractID:  contractID,
			AmountRent:  1500000,
			TotalPaid:   1500000,
			PeriodMonth: 10,
			PeriodYear:  2026,
		}

		mockRepo.On("Create", ctx, p).Return(nil)

		res, err := uc.Execute(ctx, usecase.CreatePaymentInput{Payment: p})

		assert.NoError(t, err)
		assert.Equal(t, p, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("nil payload", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreatePaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreatePaymentInput{Payment: nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreatePaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreatePaymentInput{
			Payment: &payment.Payment{PropertyID: uuid.Nil, ContractID: contractID},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing contract id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewCreatePaymentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreatePaymentInput{
			Payment: &payment.Payment{PropertyID: propID, ContractID: uuid.Nil},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
