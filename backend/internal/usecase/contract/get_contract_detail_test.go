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

func TestGetContractDetailUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	contractID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetContractDetailUseCase(repo)

		expected := &contract.ContractDetail{}
		repo.On("Detail", ctx, propID, contractID).Return(expected, nil)

		res, err := uc.Execute(ctx, contractuc.GetContractDetailInput{
			PropertyID: propID,
			ContractID: contractID,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetContractDetailUseCase(repo)

		res, err := uc.Execute(ctx, contractuc.GetContractDetailInput{
			ContractID: contractID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetContractDetailUseCase(repo)

		res, err := uc.Execute(ctx, contractuc.GetContractDetailInput{
			PropertyID: propID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewGetContractDetailUseCase(repo)

		repo.On("Detail", ctx, propID, contractID).Return(nil, errors.New("db error"))

		res, err := uc.Execute(ctx, contractuc.GetContractDetailInput{
			PropertyID: propID,
			ContractID: contractID,
		})
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
