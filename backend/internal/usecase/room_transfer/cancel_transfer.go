package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type CancelTransferInput struct {
	PropertyID uuid.UUID
	TransferID uuid.UUID
	ActorID    uuid.UUID
	IsTenant   bool
}

type CancelTransferUseCase struct {
	repo room_transfer.Repository
}

func NewCancelTransferUseCase(repo room_transfer.Repository) *CancelTransferUseCase {
	return &CancelTransferUseCase{repo: repo}
}

func (uc *CancelTransferUseCase) Execute(ctx context.Context, input CancelTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TransferID == uuid.Nil {
		return nil, errors.New("transfer ID is required")
	}
	return uc.repo.CancelTransfer(ctx, input.PropertyID, input.TransferID, input.ActorID, input.IsTenant)
}
