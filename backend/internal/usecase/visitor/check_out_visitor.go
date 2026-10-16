package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type CheckOutVisitorInput struct {
	PropertyID uuid.UUID
	ID         uuid.UUID
	ActorID    uuid.UUID
	Notes      *string
}

type CheckOutVisitorUseCase struct {
	repo visitor.Repository
}

func NewCheckOutVisitorUseCase(repo visitor.Repository) *CheckOutVisitorUseCase {
	return &CheckOutVisitorUseCase{repo: repo}
}

func (uc *CheckOutVisitorUseCase) Execute(ctx context.Context, input CheckOutVisitorInput) (*visitor.VisitorPermit, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ID == uuid.Nil {
		return nil, errors.New("permit ID is required")
	}
	return uc.repo.CheckOut(ctx, input.PropertyID, input.ID, input.ActorID, input.Notes)
}
