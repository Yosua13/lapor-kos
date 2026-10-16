package contract_test

import (
	"context"
	"errors"
	"testing"
	"time"

	contractuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestTransitionContractUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	contractID := uuid.New()
	now := time.Now()

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewTransitionContractUseCase(repo)

		repo.On("Transition", ctx, propID, actorID, contractID, "active", "approved", &now).Return(nil)

		err := uc.Execute(ctx, contractuc.TransitionContractInput{
			PropertyID:    propID,
			ActorID:       actorID,
			ContractID:    contractID,
			ToStatus:      "active",
			Reason:        "approved",
			EffectiveDate: &now,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewTransitionContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.TransitionContractInput{
			ContractID: contractID,
			ToStatus:   "active",
		})
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewTransitionContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.TransitionContractInput{
			PropertyID: propID,
			ToStatus:   "active",
		})
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("empty to status", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewTransitionContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.TransitionContractInput{
			PropertyID: propID,
			ContractID: contractID,
		})
		assert.EqualError(t, err, "target status is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewTransitionContractUseCase(repo)

		repo.On("Transition", ctx, propID, actorID, contractID, "active", "", (*time.Time)(nil)).Return(errors.New("db error"))

		err := uc.Execute(ctx, contractuc.TransitionContractInput{
			PropertyID: propID,
			ActorID:    actorID,
			ContractID: contractID,
			ToStatus:   "active",
		})
		assert.EqualError(t, err, "db error")
	})
}
