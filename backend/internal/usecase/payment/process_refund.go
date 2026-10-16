package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type ProcessRefundInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	RefundID   uuid.UUID
	Request    payment.ProcessRefundPayload
}

type ProcessRefundUseCase struct {
	repo payment.Repository
}

func NewProcessRefundUseCase(repo payment.Repository) *ProcessRefundUseCase {
	return &ProcessRefundUseCase{repo: repo}
}

func (uc *ProcessRefundUseCase) Execute(ctx context.Context, input ProcessRefundInput) (*payment.RefundRequest, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.RefundID == uuid.Nil {
		return nil, errors.New("refund ID is required")
	}
	return uc.repo.ProcessRefund(ctx, input.PropertyID, input.ActorID, input.RefundID, input.Request)
}
