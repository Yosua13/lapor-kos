package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type GetReceivablesAgingInput struct {
	PropertyID uuid.UUID
}

type GetReceivablesAgingUseCase struct {
	repo finance.Repository
}

func NewGetReceivablesAgingUseCase(repo finance.Repository) *GetReceivablesAgingUseCase {
	return &GetReceivablesAgingUseCase{repo: repo}
}

func (uc *GetReceivablesAgingUseCase) Execute(ctx context.Context, input GetReceivablesAgingInput) (*finance.ReceivablesAgingSummary, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetReceivablesAging(ctx, input.PropertyID)
}
