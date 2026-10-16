package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type ExecuteTransferInput struct {
	PropertyID uuid.UUID
	TransferID uuid.UUID
	ActorID    uuid.UUID
}

type ExecuteTransferUseCase struct {
	repo room_transfer.Repository
}

func NewExecuteTransferUseCase(repo room_transfer.Repository) *ExecuteTransferUseCase {
	return &ExecuteTransferUseCase{repo: repo}
}

func (uc *ExecuteTransferUseCase) Execute(ctx context.Context, input ExecuteTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TransferID == uuid.Nil {
		return nil, errors.New("transfer ID is required")
	}
	return uc.repo.ExecuteTransfer(ctx, input.PropertyID, input.TransferID, input.ActorID)
}
