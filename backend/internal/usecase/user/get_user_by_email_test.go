package user_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/stretchr/testify/assert"
)

func TestGetUserByEmailUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	email := "test@example.com"

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByEmailUseCase(repo)

		expected := &user.User{Email: email}
		repo.On("FindByEmail", ctx, email).Return(expected, nil)

		res, err := uc.Execute(ctx, email)
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty email", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByEmailUseCase(repo)

		res, err := uc.Execute(ctx, "")
		assert.Nil(t, res)
		assert.EqualError(t, err, "email is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByEmailUseCase(repo)

		repo.On("FindByEmail", ctx, email).Return(nil, errors.New("not found"))

		res, err := uc.Execute(ctx, email)
		assert.Nil(t, res)
		assert.EqualError(t, err, "not found")
	})
}
