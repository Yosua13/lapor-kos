package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type GetVisitorSummaryUseCase struct {
	repo visitor.Repository
}

func NewGetVisitorSummaryUseCase(repo visitor.Repository) *GetVisitorSummaryUseCase {
	return &GetVisitorSummaryUseCase{repo: repo}
}

func (uc *GetVisitorSummaryUseCase) Execute(ctx context.Context, propertyID uuid.UUID) (*visitor.VisitorPermitSummary, error) {
	if propertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetSummary(ctx, propertyID)
}
