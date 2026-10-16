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

func TestCreateVisitorPermitUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCreateVisitorPermitUseCase(repo)

		permit := &visitor.VisitorPermit{
			PropertyID: propID,
			GuestName:  "Jane Doe",
		}
		repo.On("Create", ctx, permit).Return(permit, nil)

		res, err := uc.Execute(ctx, visitoruc.CreateVisitorPermitInput{Permit: permit})
		assert.NoError(t, err)
		assert.Equal(t, permit, res)
		repo.AssertExpectations(t)
	})

	t.Run("nil permit", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCreateVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CreateVisitorPermitInput{Permit: nil})
		assert.Nil(t, res)
		assert.EqualError(t, err, "permit payload is required")
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCreateVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CreateVisitorPermitInput{
			Permit: &visitor.VisitorPermit{GuestName: "Jane Doe"},
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty guest name", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCreateVisitorPermitUseCase(repo)

		res, err := uc.Execute(ctx, visitoruc.CreateVisitorPermitInput{
			Permit: &visitor.VisitorPermit{PropertyID: propID},
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "guest name is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewCreateVisitorPermitUseCase(repo)

		permit := &visitor.VisitorPermit{
			PropertyID: propID,
			GuestName:  "Jane Doe",
		}
		repo.On("Create", ctx, permit).Return((*visitor.VisitorPermit)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, visitoruc.CreateVisitorPermitInput{Permit: permit})
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
