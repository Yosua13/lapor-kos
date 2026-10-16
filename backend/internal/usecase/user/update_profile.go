package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type UpdateProfileInput struct {
	ID               uuid.UUID
	Name             string
	Phone            string
	EmergencyContact string
}

type UpdateProfileUseCase struct {
	repo user.Repository
}

func NewUpdateProfileUseCase(repo user.Repository) *UpdateProfileUseCase {
	return &UpdateProfileUseCase{repo: repo}
}

func (uc *UpdateProfileUseCase) Execute(ctx context.Context, input UpdateProfileInput) error {
	if input.ID == uuid.Nil {
		return errors.New("user ID is required")
	}
	if input.Name == "" {
		return errors.New("name is required")
	}
	return uc.repo.UpdateProfile(ctx, input.ID, input.Name, input.Phone, input.EmergencyContact)
}
