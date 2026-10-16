package contract_test

import (
	"context"
	"errors"
	"testing"

	contractuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestAcceptByTenantUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	actorID := uuid.New()
	contractID := uuid.New()
	ip := "127.0.0.1"
	ua := "Mozilla/5.0"

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAcceptByTenantUseCase(repo)

		repo.On("AcceptByTenant", ctx, actorID, contractID, ip, ua).Return(nil)

		err := uc.Execute(ctx, contractuc.AcceptByTenantInput{
			ActorID:    actorID,
			ContractID: contractID,
			SourceIP:   ip,
			UserAgent:  ua,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty actor id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAcceptByTenantUseCase(repo)

		err := uc.Execute(ctx, contractuc.AcceptByTenantInput{
			ContractID: contractID,
		})
		assert.EqualError(t, err, "actor ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAcceptByTenantUseCase(repo)

		err := uc.Execute(ctx, contractuc.AcceptByTenantInput{
			ActorID: actorID,
		})
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewAcceptByTenantUseCase(repo)

		repo.On("AcceptByTenant", ctx, actorID, contractID, "", "").Return(errors.New("db error"))

		err := uc.Execute(ctx, contractuc.AcceptByTenantInput{
			ActorID:    actorID,
			ContractID: contractID,
		})
		assert.EqualError(t, err, "db error")
	})
}
