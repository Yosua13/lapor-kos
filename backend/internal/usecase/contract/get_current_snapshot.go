package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type GetCurrentSnapshotInput struct {
	PropertyID uuid.UUID
	ContractID uuid.UUID
}

type GetCurrentSnapshotUseCase struct {
	repo contract.Repository
}

func NewGetCurrentSnapshotUseCase(repo contract.Repository) *GetCurrentSnapshotUseCase {
	return &GetCurrentSnapshotUseCase{repo: repo}
}

func (uc *GetCurrentSnapshotUseCase) Execute(ctx context.Context, input GetCurrentSnapshotInput) (*contract.ContractVersion, *contract.Contract, error) {
	if input.PropertyID == uuid.Nil {
		return nil, nil, errors.New("property ID is required")
	}
	if input.ContractID == uuid.Nil {
		return nil, nil, errors.New("contract ID is required")
	}
	return uc.repo.CurrentSnapshot(ctx, input.PropertyID, input.ContractID)
}
