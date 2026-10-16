package user

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
)

type ResetPasswordInput struct {
	Email           string
	NewPasswordHash string
}

type ResetPasswordUseCase struct {
	repo user.Repository
}

func NewResetPasswordUseCase(repo user.Repository) *ResetPasswordUseCase {
	return &ResetPasswordUseCase{repo: repo}
}

func (uc *ResetPasswordUseCase) Execute(ctx context.Context, input ResetPasswordInput) error {
	if input.Email == "" {
		return errors.New("email is required")
	}
	if input.NewPasswordHash == "" {
		return errors.New("new password hash is required")
	}
	return uc.repo.ResetPassword(ctx, input.Email, input.NewPasswordHash)
}
