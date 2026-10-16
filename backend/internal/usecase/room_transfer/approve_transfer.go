package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type ApproveTransferInput struct {
	PropertyID uuid.UUID
	TransferID uuid.UUID
	ActorID    uuid.UUID
}

type ApproveTransferUseCase struct {
	repo room_transfer.Repository
}

func NewApproveTransferUseCase(repo room_transfer.Repository) *ApproveTransferUseCase {
	return &ApproveTransferUseCase{repo: repo}
}

func (uc *ApproveTransferUseCase) Execute(ctx context.Context, input ApproveTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TransferID == uuid.Nil {
		return nil, errors.New("transfer ID is required")
	}
	return uc.repo.ApproveTransfer(ctx, input.PropertyID, input.TransferID, input.ActorID)
}
