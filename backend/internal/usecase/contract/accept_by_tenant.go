package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type AcceptByTenantInput struct {
	ActorID    uuid.UUID
	ContractID uuid.UUID
	SourceIP   string
	UserAgent  string
}

type AcceptByTenantUseCase struct {
	repo contract.Repository
}

func NewAcceptByTenantUseCase(repo contract.Repository) *AcceptByTenantUseCase {
	return &AcceptByTenantUseCase{repo: repo}
}

func (uc *AcceptByTenantUseCase) Execute(ctx context.Context, input AcceptByTenantInput) error {
	if input.ActorID == uuid.Nil {
		return errors.New("actor ID is required")
	}
	if input.ContractID == uuid.Nil {
		return errors.New("contract ID is required")
	}
	return uc.repo.AcceptByTenant(ctx, input.ActorID, input.ContractID, input.SourceIP, input.UserAgent)
}
