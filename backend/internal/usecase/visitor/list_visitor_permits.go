package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type ListVisitorPermitsInput struct {
	TenantID uuid.UUID
	Filter   visitor.VisitorPermitFilter
	IsTenant bool
}

type ListVisitorPermitsUseCase struct {
	repo visitor.Repository
}

func NewListVisitorPermitsUseCase(repo visitor.Repository) *ListVisitorPermitsUseCase {
	return &ListVisitorPermitsUseCase{repo: repo}
}

func (uc *ListVisitorPermitsUseCase) Execute(ctx context.Context, input ListVisitorPermitsInput) ([]*visitor.VisitorPermit, int, error) {
	if input.IsTenant {
		if input.TenantID == uuid.Nil {
			return nil, 0, errors.New("tenant ID is required")
		}
		return uc.repo.ListForTenant(ctx, input.TenantID, input.Filter)
	}
	if input.Filter.PropertyID == uuid.Nil {
		return nil, 0, errors.New("property ID is required")
	}
	return uc.repo.List(ctx, input.Filter)
}
