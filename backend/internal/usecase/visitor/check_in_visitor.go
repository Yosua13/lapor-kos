package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type CheckInVisitorInput struct {
	PropertyID uuid.UUID
	ID         uuid.UUID
	ActorID    uuid.UUID
	Notes      *string
}

type CheckInVisitorUseCase struct {
	repo visitor.Repository
}

func NewCheckInVisitorUseCase(repo visitor.Repository) *CheckInVisitorUseCase {
	return &CheckInVisitorUseCase{repo: repo}
}

func (uc *CheckInVisitorUseCase) Execute(ctx context.Context, input CheckInVisitorInput) (*visitor.VisitorPermit, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ID == uuid.Nil {
		return nil, errors.New("permit ID is required")
	}
	return uc.repo.CheckIn(ctx, input.PropertyID, input.ID, input.ActorID, input.Notes)
}
