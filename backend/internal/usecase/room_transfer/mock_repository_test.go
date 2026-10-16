package room_transfer_test

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockRoomTransferRepository struct {
	mock.Mock
}

func (m *MockRoomTransferRepository) PreviewTransfer(ctx context.Context, propertyID, actorID uuid.UUID, req room_transfer.PreviewTransferRequest, isTenant bool) (*room_transfer.TransferCalculation, error) {
	args := m.Called(ctx, propertyID, actorID, req, isTenant)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.TransferCalculation), args.Error(1)
}

func (m *MockRoomTransferRepository) CreateTransferRequest(ctx context.Context, propertyID, actorID uuid.UUID, req room_transfer.CreateTransferRequest, isTenant bool) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, actorID, req, isTenant)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) ApproveTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, transferID, actorID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) RejectTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID, reason string) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, transferID, actorID, reason)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) CancelTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID, isTenant bool) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, transferID, actorID, isTenant)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) ExecuteTransfer(ctx context.Context, propertyID, transferID, actorID uuid.UUID) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, transferID, actorID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) GetTransfer(ctx context.Context, propertyID, transferID uuid.UUID) (*room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, transferID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) ListTransfers(ctx context.Context, propertyID uuid.UUID, status string) ([]room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, status)
	return args.Get(0).([]room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) ListTransfersForTenant(ctx context.Context, propertyID, tenantID uuid.UUID) ([]room_transfer.RoomTransfer, error) {
	args := m.Called(ctx, propertyID, tenantID)
	return args.Get(0).([]room_transfer.RoomTransfer), args.Error(1)
}

func (m *MockRoomTransferRepository) GetTenantRoomHistory(ctx context.Context, propertyID, tenantID uuid.UUID) ([]room_transfer.TenantRoomHistoryItem, error) {
	args := m.Called(ctx, propertyID, tenantID)
	return args.Get(0).([]room_transfer.TenantRoomHistoryItem), args.Error(1)
}
