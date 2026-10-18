package room_transfer

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type RoomTransfer = model.RoomTransfer
type RoomTransferStatus = model.RoomTransferStatus
type TransferCalculation = model.TransferCalculation
type TenantRoomHistoryItem = model.TenantRoomHistoryItem
type CreateTransferRequest = model.CreateTransferRequest
type PreviewTransferRequest = model.PreviewTransferRequest
type RejectTransferRequest = model.RejectTransferRequest

const (
	StatusPending   = model.RoomTransferPending
	StatusApproved  = model.RoomTransferApproved
	StatusCompleted = model.RoomTransferCompleted
	StatusRejected  = model.RoomTransferRejected
	StatusCancelled = model.RoomTransferCancelled
)
