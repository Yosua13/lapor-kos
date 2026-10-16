package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type SubmitPaymentProofInput struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ProofURL  string
	Method    string
	TotalPaid float64
	Notes     string
}

type SubmitPaymentProofUseCase struct {
	repo payment.Repository
}

func NewSubmitPaymentProofUseCase(repo payment.Repository) *SubmitPaymentProofUseCase {
	return &SubmitPaymentProofUseCase{repo: repo}
}

func (uc *SubmitPaymentProofUseCase) Execute(ctx context.Context, input SubmitPaymentProofInput) error {
	if input.ID == uuid.Nil {
		return errors.New("payment ID is required")
	}
	if input.UserID == uuid.Nil {
		return errors.New("user ID is required")
	}
	if input.ProofURL == "" {
		return errors.New("proof URL is required")
	}
	if input.TotalPaid <= 0 {
		return errors.New("total paid amount must be greater than zero")
	}
	return uc.repo.SubmitProof(ctx, input.ID, input.UserID, input.ProofURL, input.Method, input.TotalPaid, input.Notes)
}
