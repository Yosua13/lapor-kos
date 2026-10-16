package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type ExecuteCheckoutInput struct {
	PropertyID uuid.UUID
	CheckoutID uuid.UUID
	ActorID    uuid.UUID
	Request    checkout.ExecuteCheckoutRequest
}

type ExecuteCheckoutUseCase struct {
	repo checkout.Repository
}

func NewExecuteCheckoutUseCase(repo checkout.Repository) *ExecuteCheckoutUseCase {
	return &ExecuteCheckoutUseCase{repo: repo}
}

func (uc *ExecuteCheckoutUseCase) Execute(ctx context.Context, input ExecuteCheckoutInput) (*checkout.CheckoutCase, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.CheckoutID == uuid.Nil {
		return nil, errors.New("checkout case ID is required")
	}
	return uc.repo.ExecuteCheckout(ctx, input.PropertyID, input.CheckoutID, input.ActorID, input.Request)
}
