package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type ConfirmResolutionInput struct {
	ID      uuid.UUID
	UserID  uuid.UUID
	Comment *string
}

type ConfirmResolutionUseCase struct {
	repo complaint.Repository
}

func NewConfirmResolutionUseCase(repo complaint.Repository) *ConfirmResolutionUseCase {
	return &ConfirmResolutionUseCase{repo: repo}
}

func (uc *ConfirmResolutionUseCase) Execute(ctx context.Context, input ConfirmResolutionInput) error {
	if input.ID == uuid.Nil {
		return errors.New("complaint ID is required")
	}
	if input.UserID == uuid.Nil {
		return errors.New("user ID is required")
	}
	return uc.repo.TenantConfirmResolution(ctx, input.ID, input.UserID, input.Comment)
}
