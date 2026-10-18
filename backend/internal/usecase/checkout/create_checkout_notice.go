package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type CreateCheckoutNoticeInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	Request    checkout.CreateCheckoutNoticeRequest
}

type CreateCheckoutNoticeUseCase struct {
	repo checkout.Repository
}

func NewCreateCheckoutNoticeUseCase(repo checkout.Repository) *CreateCheckoutNoticeUseCase {
	return &CreateCheckoutNoticeUseCase{repo: repo}
}

func (uc *CreateCheckoutNoticeUseCase) Execute(ctx context.Context, input CreateCheckoutNoticeInput) (*checkout.CheckoutCase, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.ContractID == "" {
		return nil, errors.New("contract ID is required")
	}
	if input.Request.ScheduledCheckoutDate == "" {
		return nil, errors.New("scheduled checkout date is required")
	}
	if input.Request.Reason == "" {
		return nil, errors.New("reason is required")
	}
	return uc.repo.CreateCheckoutNotice(ctx, input.PropertyID, input.ActorID, input.Request)
}
