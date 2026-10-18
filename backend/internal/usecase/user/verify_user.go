package user

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type VerifyUserUseCase struct {
	repo user.Repository
}

func NewVerifyUserUseCase(repo user.Repository) *VerifyUserUseCase {
	return &VerifyUserUseCase{repo: repo}
}

func (uc *VerifyUserUseCase) Execute(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return errors.New("user ID is required")
	}
	return uc.repo.VerifyUser(ctx, id)
}
