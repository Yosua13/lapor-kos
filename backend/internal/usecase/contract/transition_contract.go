package contract

import (
	"context"
	"errors"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type TransitionContractInput struct {
	PropertyID    uuid.UUID
	ActorID       uuid.UUID
	ContractID    uuid.UUID
	ToStatus      string
	Reason        string
	EffectiveDate *time.Time
}

type TransitionContractUseCase struct {
	repo contract.Repository
}

func NewTransitionContractUseCase(repo contract.Repository) *TransitionContractUseCase {
	return &TransitionContractUseCase{repo: repo}
}

func (uc *TransitionContractUseCase) Execute(ctx context.Context, input TransitionContractInput) error {
	if input.PropertyID == uuid.Nil {
		return errors.New("property ID is required")
	}
	if input.ContractID == uuid.Nil {
		return errors.New("contract ID is required")
	}
	if input.ToStatus == "" {
		return errors.New("target status is required")
	}
	return uc.repo.Transition(ctx, input.PropertyID, input.ActorID, input.ContractID, input.ToStatus, input.Reason, input.EffectiveDate)
}
