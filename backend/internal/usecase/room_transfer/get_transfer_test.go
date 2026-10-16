package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	transferID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewGetTransferUseCase(mockRepo)

		expected := &room_transfer.RoomTransfer{ID: transferID, PropertyID: propID}
		mockRepo.On("GetTransfer", ctx, propID, transferID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetTransferInput{
			PropertyID: propID,
			TransferID: transferID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewGetTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetTransferInput{PropertyID: uuid.Nil, TransferID: transferID})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
