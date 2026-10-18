package user_test

import (
	"context"
	"errors"
	"testing"

	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUpdateProfileUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewUpdateProfileUseCase(repo)

		repo.On("UpdateProfile", ctx, userID, "Budi", "08123456789", "08987654321").Return(nil)

		err := uc.Execute(ctx, useruc.UpdateProfileInput{
			ID:               userID,
			Name:             "Budi",
			Phone:            "08123456789",
			EmergencyContact: "08987654321",
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewUpdateProfileUseCase(repo)

		err := uc.Execute(ctx, useruc.UpdateProfileInput{
			Name: "Budi",
		})
		assert.EqualError(t, err, "user ID is required")
	})

	t.Run("empty name", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewUpdateProfileUseCase(repo)

		err := uc.Execute(ctx, useruc.UpdateProfileInput{
			ID: userID,
		})
		assert.EqualError(t, err, "name is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewUpdateProfileUseCase(repo)

		repo.On("UpdateProfile", ctx, userID, "Budi", "", "").Return(errors.New("db error"))

		err := uc.Execute(ctx, useruc.UpdateProfileInput{
			ID:   userID,
			Name: "Budi",
		})
		assert.EqualError(t, err, "db error")
	})
}
