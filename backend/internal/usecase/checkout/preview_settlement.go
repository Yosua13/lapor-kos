package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type PreviewSettlementInput struct {
	PropertyID uuid.UUID
	CheckoutID uuid.UUID
}

type PreviewSettlementUseCase struct {
	repo checkout.Repository
}

func NewPreviewSettlementUseCase(repo checkout.Repository) *PreviewSettlementUseCase {
	return &PreviewSettlementUseCase{repo: repo}
}

func (uc *PreviewSettlementUseCase) Execute(ctx context.Context, input PreviewSettlementInput) (*checkout.SettlementCalculation, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.CheckoutID == uuid.Nil {
		return nil, errors.New("checkout case ID is required")
	}
	return uc.repo.PreviewSettlement(ctx, input.PropertyID, input.CheckoutID)
}
