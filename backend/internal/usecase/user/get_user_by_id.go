package user

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
	"github.com/google/uuid"
)

type GetUserByIDUseCase struct {
	repo user.Repository
}

func NewGetUserByIDUseCase(repo user.Repository) *GetUserByIDUseCase {
	return &GetUserByIDUseCase{repo: repo}
}

func (uc *GetUserByIDUseCase) Execute(ctx context.Context, id uuid.UUID) (*user.User, error) {
	if id == uuid.Nil {
		return nil, errors.New("user ID is required")
	}
	return uc.repo.FindByID(ctx, id)
}
