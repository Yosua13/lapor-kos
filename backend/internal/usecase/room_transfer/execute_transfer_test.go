package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestExecuteTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	transferID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewExecuteTransferUseCase(mockRepo)

		expected := &room_transfer.RoomTransfer{ID: transferID, PropertyID: propID, Status: "completed"}
		mockRepo.On("ExecuteTransfer", ctx, propID, transferID, actorID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ExecuteTransferInput{
			PropertyID: propID,
			TransferID: transferID,
			ActorID:    actorID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing parameters", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewExecuteTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ExecuteTransferInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
