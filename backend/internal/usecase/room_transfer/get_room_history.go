package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type GetRoomHistoryInput struct {
	PropertyID uuid.UUID
	TenantID   uuid.UUID
}

type GetRoomHistoryUseCase struct {
	repo room_transfer.Repository
}

func NewGetRoomHistoryUseCase(repo room_transfer.Repository) *GetRoomHistoryUseCase {
	return &GetRoomHistoryUseCase{repo: repo}
}

func (uc *GetRoomHistoryUseCase) Execute(ctx context.Context, input GetRoomHistoryInput) ([]room_transfer.TenantRoomHistoryItem, error) {
	if input.TenantID == uuid.Nil {
		return nil, errors.New("tenant ID is required")
	}
	return uc.repo.GetTenantRoomHistory(ctx, input.PropertyID, input.TenantID)
}
