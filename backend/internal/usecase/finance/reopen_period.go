package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ReopenPeriodInput struct {
	PropertyID   uuid.UUID
	ReopenedByID uuid.UUID
	PeriodKey    string
	Request      finance.ReopenPeriodRequest
}

type ReopenPeriodUseCase struct {
	repo finance.Repository
}

func NewReopenPeriodUseCase(repo finance.Repository) *ReopenPeriodUseCase {
	return &ReopenPeriodUseCase{repo: repo}
}

func (uc *ReopenPeriodUseCase) Execute(ctx context.Context, input ReopenPeriodInput) (*finance.FinancePeriodClosure, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.PeriodKey == "" {
		return nil, errors.New("period key is required")
	}
	if input.Request.Reason == "" {
		return nil, errors.New("reopen reason is required")
	}
	return uc.repo.ReopenPeriod(ctx, input.PropertyID, input.ReopenedByID, input.PeriodKey, input.Request)
}
