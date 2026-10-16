package room_transfer

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
)

type ListTransfersInput struct {
	PropertyID uuid.UUID
	TenantID   uuid.UUID
	Status     string
	IsTenant   bool
}

type ListTransfersUseCase struct {
	repo room_transfer.Repository
}

func NewListTransfersUseCase(repo room_transfer.Repository) *ListTransfersUseCase {
	return &ListTransfersUseCase{repo: repo}
}

func (uc *ListTransfersUseCase) Execute(ctx context.Context, input ListTransfersInput) ([]room_transfer.RoomTransfer, error) {
	if input.IsTenant {
		if input.TenantID == uuid.Nil {
			return nil, errors.New("tenant ID is required")
		}
		return uc.repo.ListTransfersForTenant(ctx, input.PropertyID, input.TenantID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.ListTransfers(ctx, input.PropertyID, input.Status)
}
