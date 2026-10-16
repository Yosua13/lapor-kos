package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type GetPeriodClosureInput struct {
	PropertyID uuid.UUID
	PeriodKey  string
}

type GetPeriodClosureUseCase struct {
	repo finance.Repository
}

func NewGetPeriodClosureUseCase(repo finance.Repository) *GetPeriodClosureUseCase {
	return &GetPeriodClosureUseCase{repo: repo}
}

func (uc *GetPeriodClosureUseCase) Execute(ctx context.Context, input GetPeriodClosureInput) (*finance.FinancePeriodClosure, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.PeriodKey == "" {
		return nil, errors.New("period key is required")
	}
	return uc.repo.GetPeriodClosure(ctx, input.PropertyID, input.PeriodKey)
}
