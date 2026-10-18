package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type VerifyPaymentInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	PaymentID  uuid.UUID
	Request    payment.VerifyPaymentRequest
}

type VerifyPaymentUseCase struct {
	repo payment.Repository
}

func NewVerifyPaymentUseCase(repo payment.Repository) *VerifyPaymentUseCase {
	return &VerifyPaymentUseCase{repo: repo}
}

func (uc *VerifyPaymentUseCase) Execute(ctx context.Context, input VerifyPaymentInput) (*payment.Payment, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.PaymentID == uuid.Nil {
		return nil, errors.New("payment ID is required")
	}
	return uc.repo.VerifyPaymentTx(ctx, input.PropertyID, input.ActorID, input.PaymentID, input.Request)
}
