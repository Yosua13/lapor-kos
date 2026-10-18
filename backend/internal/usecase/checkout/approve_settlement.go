package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type ApproveSettlementInput struct {
	PropertyID uuid.UUID
	CheckoutID uuid.UUID
	ActorID    uuid.UUID
	Notes      string
}

type ApproveSettlementUseCase struct {
	repo checkout.Repository
}

func NewApproveSettlementUseCase(repo checkout.Repository) *ApproveSettlementUseCase {
	return &ApproveSettlementUseCase{repo: repo}
}

func (uc *ApproveSettlementUseCase) Execute(ctx context.Context, input ApproveSettlementInput) (*checkout.CheckoutCase, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.CheckoutID == uuid.Nil {
		return nil, errors.New("checkout case ID is required")
	}
	return uc.repo.ApproveSettlement(ctx, input.PropertyID, input.CheckoutID, input.ActorID, input.Notes)
}
