package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type RejectTransferInput struct {
	PropertyID uuid.UUID
	TransferID uuid.UUID
	ActorID    uuid.UUID
	Reason     string
}

type RejectTransferUseCase struct {
	repo room_transfer.Repository
}

func NewRejectTransferUseCase(repo room_transfer.Repository) *RejectTransferUseCase {
	return &RejectTransferUseCase{repo: repo}
}

func (uc *RejectTransferUseCase) Execute(ctx context.Context, input RejectTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.TransferID == uuid.Nil {
		return nil, errors.New("transfer ID is required")
	}
	if input.Reason == "" {
		return nil, errors.New("rejection reason is required")
	}
	return uc.repo.RejectTransfer(ctx, input.PropertyID, input.TransferID, input.ActorID, input.Reason)
}
