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

func TestGetCurrentSnapshotUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	contractID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetCurrentSnapshotUseCase(repo)

		expectedVer := &contract.ContractVersion{ID: uuid.New()}
		expectedCont := &contract.Contract{ID: contractID}
		repo.On("CurrentSnapshot", ctx, propID, contractID).Return(expectedVer, expectedCont, nil)

		ver, cont, err := uc.Execute(ctx, contractuc.GetCurrentSnapshotInput{
			PropertyID: propID,
			ContractID: contractID,
		})
		assert.NoError(t, err)
		assert.Equal(t, expectedVer, ver)
		assert.Equal(t, expectedCont, cont)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetCurrentSnapshotUseCase(repo)

		ver, cont, err := uc.Execute(ctx, contractuc.GetCurrentSnapshotInput{
			ContractID: contractID,
		})
		assert.Nil(t, ver)
		assert.Nil(t, cont)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetCurrentSnapshotUseCase(repo)

		ver, cont, err := uc.Execute(ctx, contractuc.GetCurrentSnapshotInput{
			PropertyID: propID,
		})
		assert.Nil(t, ver)
		assert.Nil(t, cont)
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetCurrentSnapshotUseCase(repo)

		repo.On("CurrentSnapshot", ctx, propID, contractID).Return((*contract.ContractVersion)(nil), (*contract.Contract)(nil), errors.New("db error"))

		ver, cont, err := uc.Execute(ctx, contractuc.GetCurrentSnapshotInput{
			PropertyID: propID,
			ContractID: contractID,
		})
		assert.Nil(t, ver)
		assert.Nil(t, cont)
		assert.EqualError(t, err, "db error")
	})
}
