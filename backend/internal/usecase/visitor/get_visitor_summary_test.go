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

func TestGetVisitorSummaryUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorSummaryUseCase(repo)

		expected := &visitor.VisitorPermitSummary{ActiveCount: 5}
		repo.On("GetSummary", ctx, propID).Return(expected, nil)

		res, err := uc.Execute(ctx, propID)
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorSummaryUseCase(repo)

		res, err := uc.Execute(ctx, uuid.Nil)
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewGetVisitorSummaryUseCase(repo)

		repo.On("GetSummary", ctx, propID).Return((*visitor.VisitorPermitSummary)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, propID)
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
