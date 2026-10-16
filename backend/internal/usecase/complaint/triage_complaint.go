package complaint

import (
	"context"
	"errors"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type TriageInput struct {
	ID               uuid.UUID
	PropertyID       uuid.UUID
	Priority         string
	Impact           string
	AccessWindow     *string
	FirstResponseDue *time.Time
	ResolutionDue    *time.Time
	ActorID          *uuid.UUID
	ActorName        string
	ActorRole        string
	Reason           *string
}

type TriageComplaintUseCase struct {
	repo complaint.Repository
}

func NewTriageComplaintUseCase(repo complaint.Repository) *TriageComplaintUseCase {
	return &TriageComplaintUseCase{repo: repo}
}

func (uc *TriageComplaintUseCase) Execute(ctx context.Context, input TriageInput) error {
	if input.ID == uuid.Nil {
		return errors.New("complaint ID is required")
	}
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.Priority == "" {
		return errors.New("priority is required")
	}
	if input.Impact == "" {
		return errors.New("impact is required")
	}
	return uc.repo.Triage(ctx, input.ID, input.PropertyID, input.Priority, input.Impact, input.AccessWindow, input.FirstResponseDue, input.ResolutionDue, input.ActorID, input.ActorName, input.ActorRole, input.Reason)
}
