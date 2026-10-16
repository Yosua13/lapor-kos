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

func TestCheckInVisitorUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	permitID := uuid.New()
	actorID := uuid.New()
	notes := "Check-in OK"

	t.Run("success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCheckInVisitorUseCase(repo)

		expected := &visitor.VisitorPermit{ID: permitID, Status: visitor.StatusActive}
		repo.On("CheckIn", ctx, propID, permitID, actorID, &notes).Return(expected, nil)

		res, err := uc.Execute(ctx, visitoruc.CheckInVisitorInput{
			PropertyID: propID,
			ID:         permitID,
			ActorID:    actorID,
			Notes:      &notes,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCheckInVisitorUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CheckInVisitorInput{
			ID: permitID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty permit id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCheckInVisitorUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CheckInVisitorInput{
			PropertyID: propID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "permit ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCheckInVisitorUseCase(repo)

		repo.On("CheckIn", ctx, propID, permitID, actorID, (*string)(nil)).Return((*visitor.VisitorPermit)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, visitoruc.CheckInVisitorInput{
			PropertyID: propID,
			ID:         permitID,
			ActorID:    actorID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
