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

func TestCancelVisitorPermitUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	permitID := uuid.New()
	actorID := uuid.New()
	reason := "Changed plans"

	t.Run("success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCancelVisitorPermitUseCase(repo)

		expected := &visitor.VisitorPermit{ID: permitID, Status: visitor.StatusCancelled}
		repo.On("Cancel", ctx, permitID, actorID, true, &reason).Return(expected, nil)

		res, err := uc.Execute(ctx, visitoruc.CancelVisitorPermitInput{
			ID:       permitID,
			ActorID:  actorID,
			IsTenant: true,
			Reason:   &reason,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty permit id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCancelVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CancelVisitorPermitInput{
			ActorID: actorID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "permit ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCancelVisitorPermitUseCase(repo)

		repo.On("Cancel", ctx, permitID, actorID, false, (*string)(nil)).Return((*visitor.VisitorPermit)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, visitoruc.CancelVisitorPermitInput{
			ID:       permitID,
			ActorID:  actorID,
			IsTenant: false,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
