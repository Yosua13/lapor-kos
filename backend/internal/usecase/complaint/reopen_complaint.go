package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type ReopenComplaintInput struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Reason string
}

type ReopenComplaintUseCase struct {
	repo complaint.Repository
}

func NewReopenComplaintUseCase(repo complaint.Repository) *ReopenComplaintUseCase {
	return &ReopenComplaintUseCase{repo: repo}
}

func (uc *ReopenComplaintUseCase) Execute(ctx context.Context, input ReopenComplaintInput) error {
	if input.ID == uuid.Nil {
		return errors.New("complaint ID is required")
	}
	if input.UserID == uuid.Nil {
		return errors.New("user ID is required")
	}
	if input.Reason == "" {
		return errors.New("reason is required")
	}
	return uc.repo.TenantReopen(ctx, input.ID, input.UserID, input.Reason)
}
