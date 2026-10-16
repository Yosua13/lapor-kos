package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type AmendContractInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	Amended    *contract.Contract
	Reason     string
}

type AmendContractUseCase struct {
	repo contract.Repository
}

func NewAmendContractUseCase(repo contract.Repository) *AmendContractUseCase {
	return &AmendContractUseCase{repo: repo}
}

func (uc *AmendContractUseCase) Execute(ctx context.Context, input AmendContractInput) error {
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.Amended == nil {
		return errors.New("amended contract is required")
	}
	if input.Reason == "" {
		return errors.New("reason is required")
	}
	return uc.repo.Amend(ctx, input.PropertyID, input.ActorID, input.Amended, input.Reason)
}
