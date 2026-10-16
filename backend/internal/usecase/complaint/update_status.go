package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type UpdateStatusInput struct {
	ID         uuid.UUID
	PropertyID uuid.UUID
	Status     string
	ActorID    *uuid.UUID
	ActorName  string
	ActorRole  string
	Notes      *string
}

type UpdateStatusUseCase struct {
	repo complaint.Repository
}

func NewUpdateStatusUseCase(repo complaint.Repository) *UpdateStatusUseCase {
	return &UpdateStatusUseCase{repo: repo}
}

func (uc *UpdateStatusUseCase) Execute(ctx context.Context, input UpdateStatusInput) error {
	if input.ID == uuid.Nil {
		return errors.New("complaint ID is required")
	}
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.Status == "" {
		return errors.New("status is required")
	}
	return uc.repo.UpdateStatus(ctx, input.ID, input.PropertyID, input.Status, input.ActorID, input.ActorName, input.ActorRole, input.Notes)
}
