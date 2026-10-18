package user

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type GetUserByEmailUseCase struct {
	repo user.Repository
}

func NewGetUserByEmailUseCase(repo user.Repository) *GetUserByEmailUseCase {
	return &GetUserByEmailUseCase{repo: repo}
}

func (uc *GetUserByEmailUseCase) Execute(ctx context.Context, email string) (*user.User, error) {
	if email == "" {
		return nil, errors.New("email is required")
	}
	return uc.repo.FindByEmail(ctx, email)
}
