package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type CreateTransferInput struct {
	PropertyID uuid.UUID
	ActorID    uuid.UUID
	Request    room_transfer.CreateTransferRequest
	IsTenant   bool
}

type CreateTransferUseCase struct {
	repo room_transfer.Repository
}

func NewCreateTransferUseCase(repo room_transfer.Repository) *CreateTransferUseCase {
	return &CreateTransferUseCase{repo: repo}
}

func (uc *CreateTransferUseCase) Execute(ctx context.Context, input CreateTransferInput) (*room_transfer.RoomTransfer, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Request.ToRoomID == uuid.Nil {
		return nil, errors.New("target room ID is required")
	}
	if input.Request.EffectiveDate == "" {
		return nil, errors.New("effective date is required")
	}
	if input.Request.Reason == "" {
		return nil, errors.New("reason is required")
	}
	return uc.repo.CreateTransferRequest(ctx, input.PropertyID, input.ActorID, input.Request, input.IsTenant)
}
