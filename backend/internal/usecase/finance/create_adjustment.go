package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type CreateAdjustmentInput struct {
	PropertyID    uuid.UUID
	RequestedByID uuid.UUID
	PeriodCloseID uuid.UUID
	Request       finance.CreatePeriodAdjustmentRequest
}

type CreateAdjustmentUseCase struct {
	repo finance.Repository
}

func NewCreateAdjustmentUseCase(repo finance.Repository) *CreateAdjustmentUseCase {
	return &CreateAdjustmentUseCase{repo: repo}
}

func (uc *CreateAdjustmentUseCase) Execute(ctx context.Context, input CreateAdjustmentInput) (*finance.FinancePeriodAdjustment, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.PeriodCloseID == uuid.Nil {
		return nil, errors.New("period close ID is required")
	}
	if input.Request.AmountMinor <= 0 {
		return nil, errors.New("adjustment amount must be greater than zero")
	}
	return uc.repo.CreateAdjustment(ctx, input.PropertyID, input.RequestedByID, input.PeriodCloseID, input.Request)
}
