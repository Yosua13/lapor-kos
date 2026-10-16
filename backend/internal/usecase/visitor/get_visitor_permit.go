package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type GetVisitorPermitInput struct {
	PropertyID uuid.UUID
	TenantID   uuid.UUID
	ID         uuid.UUID
	IsTenant   bool
}

type GetVisitorPermitUseCase struct {
	repo visitor.Repository
}

func NewGetVisitorPermitUseCase(repo visitor.Repository) *GetVisitorPermitUseCase {
	return &GetVisitorPermitUseCase{repo: repo}
}

func (uc *GetVisitorPermitUseCase) Execute(ctx context.Context, input GetVisitorPermitInput) (*visitor.VisitorPermit, error) {
	if input.ID == uuid.Nil {
		return nil, errors.New("permit ID is required")
	}
	if input.IsTenant {
		if input.TenantID == uuid.Nil {
			return nil, errors.New("tenant ID is required")
		}
		return uc.repo.GetByIDForTenant(ctx, input.TenantID, input.ID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetByID(ctx, input.PropertyID, input.ID)
}
