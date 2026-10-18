package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type RenewContractInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	ContractID uuid.UUID
	Child      *contract.Contract
	Reason     string
}

type RenewContractUseCase struct {
	repo contract.Repository
}

func NewRenewContractUseCase(repo contract.Repository) *RenewContractUseCase {
	return &RenewContractUseCase{repo: repo}
}

func (uc *RenewContractUseCase) Execute(ctx context.Context, input RenewContractInput) error {
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.ContractID == uuid.Nil {
		return errors.New("contract ID is required")
	}
	if input.Child == nil {
		return errors.New("renewal contract is required")
	}
	if input.Reason == "" {
		return errors.New("reason is required")
	}
	return uc.repo.Renew(ctx, input.PropertyID, input.ActorID, input.ContractID, input.Child, input.Reason)
}
