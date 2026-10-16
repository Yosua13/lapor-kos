package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type GetReconciliationInput struct {
	PropertyID uuid.UUID
	StartDate  string
	EndDate    string
}

type GetReconciliationUseCase struct {
	repo payment.Repository
}

func NewGetReconciliationUseCase(repo payment.Repository) *GetReconciliationUseCase {
	return &GetReconciliationUseCase{repo: repo}
}

func (uc *GetReconciliationUseCase) Execute(ctx context.Context, input GetReconciliationInput) (*payment.ReconciliationReport, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetReconciliationReport(ctx, input.PropertyID, input.StartDate, input.EndDate)
}
