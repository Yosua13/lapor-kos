package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type GetContractDetailInput struct {
	PropertyID uuid.UUID
	ContractID uuid.UUID
}

type GetContractDetailUseCase struct {
	repo contract.Repository
}

func NewGetContractDetailUseCase(repo contract.Repository) *GetContractDetailUseCase {
	return &GetContractDetailUseCase{repo: repo}
}

func (uc *GetContractDetailUseCase) Execute(ctx context.Context, input GetContractDetailInput) (*contract.ContractDetail, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ContractID == uuid.Nil {
		return nil, errors.New("contract ID is required")
	}
	return uc.repo.Detail(ctx, input.PropertyID, input.ContractID)
}
