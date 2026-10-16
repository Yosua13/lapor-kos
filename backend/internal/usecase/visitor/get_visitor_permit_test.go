package visitor_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	visitoruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetVisitorPermitUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()
	permitID := uuid.New()

	t.Run("staff success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		expected := &visitor.VisitorPermit{ID: permitID}
		repo.On("GetByID", ctx, propID, permitID).Return(expected, nil)

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			PropertyID: propID,
			ID:         permitID,
			IsTenant:   false,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("tenant success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		expected := &visitor.VisitorPermit{ID: permitID}
		repo.On("GetByIDForTenant", ctx, tenantID, permitID).Return(expected, nil)

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			TenantID: tenantID,
			ID:       permitID,
			IsTenant: true,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			PropertyID: propID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "permit ID is required")
	})

	t.Run("tenant empty tenant id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			ID:       permitID,
			IsTenant: true,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "tenant ID is required")
	})

	t.Run("staff empty property id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			ID:       permitID,
			IsTenant: false,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorPermitUseCase(repo)

		repo.On("GetByID", ctx, propID, permitID).Return((*visitor.VisitorPermit)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, visitoruc.GetVisitorPermitInput{
			PropertyID: propID,
			ID:         permitID,
			IsTenant:   false,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
