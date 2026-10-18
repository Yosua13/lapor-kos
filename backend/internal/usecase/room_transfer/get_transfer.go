package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type GetTransferInput struct {
	PropertyID uuid.UUID
	TransferID uuid.UUID
}

type GetTransferUseCase struct {
	repo room_transfer.Repository
}

func NewGetTransferUseCase(repo room_transfer.Repository) *GetTransferUseCase {
	return &GetTransferUseCase{repo: repo}
}

func (uc *GetTransferUseCase) Execute(ctx context.Context, input GetTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TransferID == uuid.Nil {
		return nil, errors.New("transfer ID is required")
	}
	return uc.repo.GetTransfer(ctx, input.PropertyID, input.TransferID)
}
