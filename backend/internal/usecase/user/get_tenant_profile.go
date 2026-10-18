package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type GetTenantProfileInput struct {
	PropertyID uuid.UUID
	TenantID   uuid.UUID
}

type GetTenantProfileUseCase struct {
	repo user.Repository
}

func NewGetTenantProfileUseCase(repo user.Repository) *GetTenantProfileUseCase {
	return &GetTenantProfileUseCase{repo: repo}
}

func (uc *GetTenantProfileUseCase) Execute(ctx context.Context, input GetTenantProfileInput) (map[string]any, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TenantID == uuid.Nil {
		return nil, errors.New("tenant ID is required")
	}
	return uc.repo.GetTenantProfile(ctx, input.PropertyID, input.TenantID)
}
