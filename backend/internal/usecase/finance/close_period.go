package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ClosePeriodInput struct {
	PropertyID uuid.UUID
	ClosedByID uuid.UUID
	Request    finance.ClosePeriodRequest
}

type ClosePeriodUseCase struct {
	repo finance.Repository
}

func NewClosePeriodUseCase(repo finance.Repository) *ClosePeriodUseCase {
	return &ClosePeriodUseCase{repo: repo}
}

func (uc *ClosePeriodUseCase) Execute(ctx context.Context, input ClosePeriodInput) (*finance.FinancePeriodClosure, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.PeriodKey == "" {
		return nil, errors.New("period key (YYYY-MM) is required")
	}
	return uc.repo.ClosePeriod(ctx, input.PropertyID, input.ClosedByID, input.Request)
}
