package user_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRegisterUserUseCase_Execute(t *testing.T) {
	ctx := context.Background()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewRegisterUserUseCase(repo)

		u := &user.User{
			ID:           uuid.New(),
			Email:        "test@example.com",
			PasswordHash: "hashed_password",
		}
		repo.On("Create", ctx, u).Return(nil)

		res, err := uc.Execute(ctx, useruc.RegisterUserInput{User: u})
		assert.NoError(t, err)
		assert.Equal(t, u, res)
		repo.AssertExpectations(t)
	})

	t.Run("nil user", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewRegisterUserUseCase(repo)

		res, err := uc.Execute(ctx, useruc.RegisterUserInput{User: nil})
		assert.Nil(t, res)
		assert.EqualError(t, err, "user payload is required")
	})

	t.Run("empty email", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewRegisterUserUseCase(repo)

		res, err := uc.Execute(ctx, useruc.RegisterUserInput{User: &user.User{PasswordHash: "secret"}})
		assert.Nil(t, res)
		assert.EqualError(t, err, "email is required")
	})

	t.Run("empty password", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewRegisterUserUseCase(repo)

		res, err := uc.Execute(ctx, useruc.RegisterUserInput{User: &user.User{Email: "test@example.com"}})
		assert.Nil(t, res)
		assert.EqualError(t, err, "password hash is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewRegisterUserUseCase(repo)

		u := &user.User{
			Email:        "test@example.com",
			PasswordHash: "hashed_password",
		}
		repo.On("Create", ctx, u).Return(errors.New("duplicate key"))

		res, err := uc.Execute(ctx, useruc.RegisterUserInput{User: u})
		assert.Nil(t, res)
		assert.EqualError(t, err, "duplicate key")
	})
}
