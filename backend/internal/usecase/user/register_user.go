package user

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type RegisterUserInput struct {
	User *user.User
}

type RegisterUserUseCase struct {
	repo user.Repository
}

func NewRegisterUserUseCase(repo user.Repository) *RegisterUserUseCase {
	return &RegisterUserUseCase{repo: repo}
}

func (uc *RegisterUserUseCase) Execute(ctx context.Context, input RegisterUserInput) (*user.User, error) {
	if input.User == nil {
		return nil, errors.New("user payload is required")
	}
	if input.User.Email == "" {
		return nil, errors.New("email is required")
	}
	if input.User.PasswordHash == "" {
		return nil, errors.New("password hash is required")
	}
	if err := uc.repo.Create(ctx, input.User); err != nil {
		return nil, err
	}
	return input.User, nil
}
