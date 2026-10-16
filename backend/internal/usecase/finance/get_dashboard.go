package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type GetDashboardInput struct {
	PropertyID  uuid.UUID
	PeriodStart string
	PeriodEnd   string
}

type GetDashboardUseCase struct {
	repo finance.Repository
}

func NewGetDashboardUseCase(repo finance.Repository) *GetDashboardUseCase {
	return &GetDashboardUseCase{repo: repo}
}

func (uc *GetDashboardUseCase) Execute(ctx context.Context, input GetDashboardInput) (*finance.FinancialDashboardSummary, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetFinancialDashboard(ctx, input.PropertyID, input.PeriodStart, input.PeriodEnd)
}
