package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type PreviewTransferInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	Request    room_transfer.PreviewTransferRequest
	IsTenant   bool
}

type PreviewTransferUseCase struct {
	repo room_transfer.Repository
}

func NewPreviewTransferUseCase(repo room_transfer.Repository) *PreviewTransferUseCase {
	return &PreviewTransferUseCase{repo: repo}
}

func (uc *PreviewTransferUseCase) Execute(ctx context.Context, input PreviewTransferInput) (*room_transfer.TransferCalculation, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.ToRoomID == uuid.Nil {
		return nil, errors.New("target room ID is required")
	}
	if input.Request.EffectiveDate == "" {
		return nil, errors.New("effective date is required")
	}
	return uc.repo.PreviewTransfer(ctx, input.PropertyID, input.ActorID, input.Request, input.IsTenant)
}
