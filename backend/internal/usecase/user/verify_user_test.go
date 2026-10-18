package user_test

import (
	"context"
	"errors"
	"testing"

	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestVerifyUserUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewVerifyUserUseCase(repo)

		repo.On("VerifyUser", ctx, userID).Return(nil)

		err := uc.Execute(ctx, userID)
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("nil id", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewVerifyUserUseCase(repo)

		err := uc.Execute(ctx, uuid.Nil)
		assert.EqualError(t, err, "user ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewVerifyUserUseCase(repo)

		repo.On("VerifyUser", ctx, userID).Return(errors.New("db error"))

		err := uc.Execute(ctx, userID)
		assert.EqualError(t, err, "db error")
	})
}
