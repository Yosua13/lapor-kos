package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type ListCheckoutCasesInput struct {
	PropertyID uuid.UUID
	TenantID   uuid.UUID
	IsTenant   bool
	Filter     checkout.CheckoutListFilter
}

type ListCheckoutCasesUseCase struct {
	repo checkout.Repository
}

func NewListCheckoutCasesUseCase(repo checkout.Repository) *ListCheckoutCasesUseCase {
	return &ListCheckoutCasesUseCase{repo: repo}
}

func (uc *ListCheckoutCasesUseCase) Execute(ctx context.Context, input ListCheckoutCasesInput) (any, error) {
	if input.IsTenant {
		if input.TenantID == uuid.Nil {
			return nil, errors.New("tenant ID is required")
		}
		return uc.repo.ListCheckoutCasesForTenant(ctx, input.TenantID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.ListCheckoutCases(ctx, input.PropertyID, input.Filter)
}
