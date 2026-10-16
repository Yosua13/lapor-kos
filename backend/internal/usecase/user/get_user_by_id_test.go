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

func TestGetUserByIDUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByIDUseCase(repo)

		expected := &user.User{ID: userID, Email: "test@example.com"}
		repo.On("FindByID", ctx, userID).Return(expected, nil)

		res, err := uc.Execute(ctx, userID)
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("nil id", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByIDUseCase(repo)

		res, err := uc.Execute(ctx, uuid.Nil)
		assert.Nil(t, res)
		assert.EqualError(t, err, "user ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetUserByIDUseCase(repo)

		repo.On("FindByID", ctx, userID).Return(nil, errors.New("not found"))

		res, err := uc.Execute(ctx, userID)
		assert.Nil(t, res)
		assert.EqualError(t, err, "not found")
	})
}
