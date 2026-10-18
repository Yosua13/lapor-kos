package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestApproveTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	transferID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewApproveTransferUseCase(mockRepo)

		expected := &room_transfer.RoomTransfer{ID: transferID, PropertyID: propID, Status: "approved"}
		mockRepo.On("ApproveTransfer", ctx, propID, transferID, actorID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ApproveTransferInput{
			PropertyID: propID,
			TransferID: transferID,
			ActorID:    actorID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing transfer id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewApproveTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ApproveTransferInput{PropertyID: propID, TransferID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
