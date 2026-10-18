package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type CancelCheckoutInput struct {
	PropertyID uuid.UUID
	CheckoutID uuid.UUID
	ActorID    uuid.UUID
	Reason     string
}

type CancelCheckoutUseCase struct {
	repo checkout.Repository
}

func NewCancelCheckoutUseCase(repo checkout.Repository) *CancelCheckoutUseCase {
	return &CancelCheckoutUseCase{repo: repo}
}

func (uc *CancelCheckoutUseCase) Execute(ctx context.Context, input CancelCheckoutInput) error {
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.CheckoutID == uuid.Nil {
		return errors.New("checkout case ID is required")
	}
	if input.Reason == "" {
		return errors.New("cancellation reason is required")
	}
	return uc.repo.CancelCheckout(ctx, input.PropertyID, input.CheckoutID, input.ActorID, input.Reason)
}
