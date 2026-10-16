package contract_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	contractuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestAmendContractUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	amended := &contract.Contract{ID: uuid.New()}
	reason := "Price adjustment"

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAmendContractUseCase(repo)

		repo.On("Amend", ctx, propID, actorID, amended, reason).Return(nil)

		err := uc.Execute(ctx, contractuc.AmendContractInput{
			PropertyID: propID,
			ActorID:    actorID,
			Amended:    amended,
			Reason:     reason,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAmendContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.AmendContractInput{
			Amended: amended,
			Reason:  reason,
		})
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("nil amended contract", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAmendContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.AmendContractInput{
			PropertyID: propID,
			Reason:     reason,
		})
		assert.EqualError(t, err, "amended contract is required")
	})

	t.Run("empty reason", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAmendContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.AmendContractInput{
			PropertyID: propID,
			Amended:    amended,
		})
		assert.EqualError(t, err, "reason is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAmendContractUseCase(repo)

		repo.On("Amend", ctx, propID, actorID, amended, reason).Return(errors.New("db error"))

		err := uc.Execute(ctx, contractuc.AmendContractInput{
			PropertyID: propID,
			ActorID:    actorID,
			Amended:    amended,
			Reason:     reason,
		})
		assert.EqualError(t, err, "db error")
	})
}
