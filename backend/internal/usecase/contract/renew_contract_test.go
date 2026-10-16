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

func TestRenewContractUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	contractID := uuid.New()
	child := &contract.Contract{ID: uuid.New()}
	reason := "Annual extension"

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		repo.On("Renew", ctx, propID, actorID, contractID, child, reason).Return(nil)

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			PropertyID: propID,
			ActorID:    actorID,
			ContractID: contractID,
			Child:      child,
			Reason:     reason,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			ContractID: contractID,
			Child:      child,
			Reason:     reason,
		})
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			PropertyID: propID,
			Child:      child,
			Reason:     reason,
		})
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("nil child contract", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			PropertyID: propID,
			ContractID: contractID,
			Reason:     reason,
		})
		assert.EqualError(t, err, "renewal contract is required")
	})

	t.Run("empty reason", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			PropertyID: propID,
			ContractID: contractID,
			Child:      child,
		})
		assert.EqualError(t, err, "reason is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewRenewContractUseCase(repo)

		repo.On("Renew", ctx, propID, actorID, contractID, child, reason).Return(errors.New("db error"))

		err := uc.Execute(ctx, contractuc.RenewContractInput{
			PropertyID: propID,
			ActorID:    actorID,
			ContractID: contractID,
			Child:      child,
			Reason:     reason,
		})
		assert.EqualError(t, err, "db error")
	})
}
