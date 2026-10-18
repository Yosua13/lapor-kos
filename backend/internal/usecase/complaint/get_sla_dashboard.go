package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type GetSLADashboardUseCase struct {
	repo complaint.Repository
}

func NewGetSLADashboardUseCase(repo complaint.Repository) *GetSLADashboardUseCase {
	return &GetSLADashboardUseCase{repo: repo}
}

func (uc *GetSLADashboardUseCase) Execute(ctx context.Context, propertyID uuid.UUID) (*complaint.SLADashboardStats, error) {
	if propertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetSLADashboardStats(ctx, propertyID)
}
