package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type GetCheckoutCaseInput struct {
	ID         uuid.UUID
	PropertyID uuid.UUID
	TenantID   uuid.UUID
	IsTenant   bool
}

type GetCheckoutCaseUseCase struct {
	repo checkout.Repository
}

func NewGetCheckoutCaseUseCase(repo checkout.Repository) *GetCheckoutCaseUseCase {
	return &GetCheckoutCaseUseCase{repo: repo}
}

func (uc *GetCheckoutCaseUseCase) Execute(ctx context.Context, input GetCheckoutCaseInput) (*checkout.CheckoutCase, error) {
	if input.ID == uuid.Nil {
		return nil, errors.New("checkout case ID is required")
	}
	if input.IsTenant {
		if input.TenantID == uuid.Nil {
			return nil, errors.New("tenant ID is required")
		}
		return uc.repo.GetCheckoutCaseForTenant(ctx, input.TenantID, input.ID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetCheckoutCase(ctx, input.PropertyID, input.ID)
}
