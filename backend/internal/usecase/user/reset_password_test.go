package user_test

import (
	"context"
	"errors"
	"testing"

	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/stretchr/testify/assert"
)

func TestResetPasswordUseCase_Execute(t *testing.T) {
	ctx := context.Background()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewResetPasswordUseCase(repo)

		repo.On("ResetPassword", ctx, "test@example.com", "new_hash").Return(nil)

		err := uc.Execute(ctx, useruc.ResetPasswordInput{
			Email:           "test@example.com",
			NewPasswordHash: "new_hash",
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty email", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewResetPasswordUseCase(repo)

		err := uc.Execute(ctx, useruc.ResetPasswordInput{
			NewPasswordHash: "new_hash",
		})
		assert.EqualError(t, err, "email is required")
	})

	t.Run("empty password hash", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewResetPasswordUseCase(repo)

		err := uc.Execute(ctx, useruc.ResetPasswordInput{
			Email: "test@example.com",
		})
		assert.EqualError(t, err, "new password hash is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewResetPasswordUseCase(repo)

		repo.On("ResetPassword", ctx, "test@example.com", "new_hash").Return(errors.New("db error"))

		err := uc.Execute(ctx, useruc.ResetPasswordInput{
			Email:           "test@example.com",
			NewPasswordHash: "new_hash",
		})
		assert.EqualError(t, err, "db error")
	})
}
