package payment_test

import (
	"context"
	"testing"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestSubmitPaymentProofUseCase(t *testing.T) {
	ctx := context.Background()
	payID := uuid.New()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewSubmitPaymentProofUseCase(mockRepo)

		mockRepo.On("SubmitProof", ctx, payID, userID, "http://proof.jpg", "transfer", 1500000.0, "Paid via BCA").Return(nil)

		err := uc.Execute(ctx, usecase.SubmitPaymentProofInput{
			ID:        payID,
			UserID:    userID,
			ProofURL:  "http://proof.jpg",
			Method:    "transfer",
			TotalPaid: 1500000.0,
			Notes:     "Paid via BCA",
		})

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing user id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewSubmitPaymentProofUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.SubmitPaymentProofInput{
			ID:        payID,
			UserID:    uuid.Nil,
			ProofURL:  "http://proof.jpg",
			TotalPaid: 1500000.0,
		})
		assert.Error(t, err)
	})

	t.Run("missing payment id", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewSubmitPaymentProofUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.SubmitPaymentProofInput{
			ID:        uuid.Nil,
			UserID:    userID,
			ProofURL:  "http://proof.jpg",
			TotalPaid: 1500000.0,
		})
		assert.Error(t, err)
	})

	t.Run("missing proof url", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewSubmitPaymentProofUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.SubmitPaymentProofInput{
			ID:        payID,
			UserID:    userID,
			ProofURL:  "",
			TotalPaid: 1500000.0,
		})
		assert.Error(t, err)
	})

	t.Run("zero amount", func(t *testing.T) {
		mockRepo := new(MockPaymentRepository)
		uc := usecase.NewSubmitPaymentProofUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.SubmitPaymentProofInput{
			ID:        payID,
			UserID:    userID,
			ProofURL:  "http://proof.jpg",
			TotalPaid: 0,
		})
		assert.Error(t, err)
	})
}
