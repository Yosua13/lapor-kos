package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCancelTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	transferID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewCancelTransferUseCase(mockRepo)

		expected := &room_transfer.RoomTransfer{ID: transferID, PropertyID: propID, Status: "cancelled"}
		mockRepo.On("CancelTransfer", ctx, propID, transferID, actorID, true).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.CancelTransferInput{
			PropertyID: propID,
			TransferID: transferID,
			ActorID:    actorID,
			IsTenant:   true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing transfer id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewCancelTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CancelTransferInput{PropertyID: propID, TransferID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
