package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRejectTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	transferID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewRejectTransferUseCase(mockRepo)

		expected := &room_transfer.RoomTransfer{ID: transferID, PropertyID: propID, Status: "rejected"}
		mockRepo.On("RejectTransfer", ctx, propID, transferID, actorID, "Room already booked").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.RejectTransferInput{
			PropertyID: propID,
			TransferID: transferID,
			ActorID:    actorID,
			Reason:     "Room already booked",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing reason", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewRejectTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.RejectTransferInput{
			PropertyID: propID,
			TransferID: transferID,
			Reason:     "",
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
