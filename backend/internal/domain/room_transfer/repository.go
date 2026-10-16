package room_transfer

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	PreviewTransfer(ctx context.Context, propertyID, actorID uuid.UUID, req PreviewTransferRequest, isTenant bool) (*TransferCalculation, error)
	CreateTransferRequest(ctx context.Context, propertyID, actorID uuid.UUID, req CreateTransferRequest, isTenant bool) (*RoomTransfer, error)
	ApproveTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID) (*RoomTransfer, error)
	RejectTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID, reason string) (*RoomTransfer, error)
	CancelTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID, isTenant bool) (*RoomTransfer, error)
	ExecuteTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID) (*RoomTransfer, error)
	GetTransfer(ctx context.Context, propertyID, transferID uuid.UUID) (*RoomTransfer, error)
	ListTransfers(ctx context.Context, propertyID uuid.UUID, status string) ([]RoomTransfer, error)
	ListTransfersForTenant(ctx context.Context, propertyID, tenantID uuid.UUID) ([]RoomTransfer, error)
	GetTenantRoomHistory(ctx context.Context, propertyID, tenantID uuid.UUID) ([]TenantRoomHistoryItem, error)
}
