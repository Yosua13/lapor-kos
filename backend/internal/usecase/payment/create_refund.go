package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type CreateRefundInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	Request    payment.CreateRefundRequestPayload
}

type CreateRefundUseCase struct {
	repo payment.Repository
}

func NewCreateRefundUseCase(repo payment.Repository) *CreateRefundUseCase {
	return &CreateRefundUseCase{repo: repo}
}

func (uc *CreateRefundUseCase) Execute(ctx context.Context, input CreateRefundInput) (*payment.RefundRequest, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.PaymentID == uuid.Nil {
		return nil, errors.New("payment ID is required")
	}
	if input.Request.AmountMinor <= 0 {
		return nil, errors.New("refund amount must be greater than zero")
	}
	return uc.repo.CreateRefund(ctx, input.PropertyID, input.ActorID, input.Request)
}
