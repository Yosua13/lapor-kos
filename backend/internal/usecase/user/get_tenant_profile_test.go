package user_test

import (
	"context"
	"errors"
	"testing"

	useruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetTenantProfileUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetTenantProfileUseCase(repo)

		expected := map[string]any{"name": "Tenant One"}
		repo.On("GetTenantProfile", ctx, propID, tenantID).Return(expected, nil)

		res, err := uc.Execute(ctx, useruc.GetTenantProfileInput{
			PropertyID: propID,
			TenantID:   tenantID,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetTenantProfileUseCase(repo)

		res, err := uc.Execute(ctx, useruc.GetTenantProfileInput{
			TenantID: tenantID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty tenant id", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetTenantProfileUseCase(repo)

		res, err := uc.Execute(ctx, useruc.GetTenantProfileInput{
			PropertyID: propID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "tenant ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockUserRepository)
		uc := useruc.NewGetTenantProfileUseCase(repo)

		repo.On("GetTenantProfile", ctx, propID, tenantID).Return(map[string]any(nil), errors.New("not found"))

		res, err := uc.Execute(ctx, useruc.GetTenantProfileInput{
			PropertyID: propID,
			TenantID:   tenantID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "not found")
	})
}
