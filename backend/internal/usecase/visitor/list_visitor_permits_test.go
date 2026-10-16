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

func TestListVisitorPermitsUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()
	filter := visitor.VisitorPermitFilter{PropertyID: propID}

	t.Run("staff success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewListVisitorPermitsUseCase(repo)

		expected := []*visitor.VisitorPermit{{ID: uuid.New()}}
		repo.On("List", ctx, filter).Return(expected, 1, nil)

		res, total, err := uc.Execute(ctx, visitoruc.ListVisitorPermitsInput{
			Filter:   filter,
			IsTenant: false,
		})
		assert.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("tenant success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewListVisitorPermitsUseCase(repo)

		expected := []*visitor.VisitorPermit{{ID: uuid.New()}}
		repo.On("ListForTenant", ctx, tenantID, filter).Return(expected, 1, nil)

		res, total, err := uc.Execute(ctx, visitoruc.ListVisitorPermitsInput{
			TenantID: tenantID,
			Filter:   filter,
			IsTenant: true,
		})
		assert.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("tenant empty tenant id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewListVisitorPermitsUseCase(repo)

		res, total, err := uc.Execute(ctx, visitoruc.ListVisitorPermitsInput{
			Filter:   filter,
			IsTenant: true,
		})
		assert.Nil(t, res)
		assert.Equal(t, 0, total)
		assert.EqualError(t, err, "tenant ID is required")
	})

	t.Run("staff empty property id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewListVisitorPermitsUseCase(repo)

		res, total, err := uc.Execute(ctx, visitoruc.ListVisitorPermitsInput{
			Filter:   visitor.VisitorPermitFilter{},
			IsTenant: false,
		})
		assert.Nil(t, res)
		assert.Equal(t, 0, total)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewListVisitorPermitsUseCase(repo)

		repo.On("List", ctx, filter).Return(([]*visitor.VisitorPermit)(nil), 0, errors.New("db error"))

		res, total, err := uc.Execute(ctx, visitoruc.ListVisitorPermitsInput{
			Filter:   filter,
			IsTenant: false,
		})
		assert.Nil(t, res)
		assert.Equal(t, 0, total)
		assert.EqualError(t, err, "db error")
	})
}
