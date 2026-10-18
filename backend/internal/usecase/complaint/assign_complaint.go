package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type AssignComplaintInput struct {
	ID         uuid.UUID
	PropertyID uuid.UUID
	AssignedTo *uuid.UUID
	ActorID    *uuid.UUID
	ActorName  string
	ActorRole  string
	Notes      *string
}

type AssignComplaintUseCase struct {
	repo complaint.Repository
}

func NewAssignComplaintUseCase(repo complaint.Repository) *AssignComplaintUseCase {
	return &AssignComplaintUseCase{repo: repo}
}

func (uc *AssignComplaintUseCase) Execute(ctx context.Context, input AssignComplaintInput) error {
	if input.ID == uuid.Nil {
		return errors.New("complaint ID is required")
	}
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	return uc.repo.Assign(ctx, input.ID, input.PropertyID, input.AssignedTo, input.ActorID, input.ActorName, input.ActorRole, input.Notes)
}
