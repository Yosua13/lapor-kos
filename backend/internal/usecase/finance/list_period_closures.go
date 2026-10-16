package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ListPeriodClosuresInput struct {
	PropertyID uuid.UUID
}

type ListPeriodClosuresUseCase struct {
	repo finance.Repository
}

func NewListPeriodClosuresUseCase(repo finance.Repository) *ListPeriodClosuresUseCase {
	return &ListPeriodClosuresUseCase{repo: repo}
}

func (uc *ListPeriodClosuresUseCase) Execute(ctx context.Context, input ListPeriodClosuresInput) ([]finance.FinancePeriodClosure, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.ListPeriodClosures(ctx, input.PropertyID)
}
