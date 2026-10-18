package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListTransfersUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()

	t.Run("success property list", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewListTransfersUseCase(mockRepo)

		expected := []room_transfer.RoomTransfer{{ID: uuid.New(), PropertyID: propID}}
		mockRepo.On("ListTransfers", ctx, propID, "pending").Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListTransfersInput{
			PropertyID: propID,
			Status:     "pending",
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant list", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewListTransfersUseCase(mockRepo)

		expected := []room_transfer.RoomTransfer{{ID: uuid.New(), TenantID: tenantID}}
		mockRepo.On("ListTransfersForTenant", ctx, propID, tenantID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListTransfersInput{
			PropertyID: propID,
			TenantID:   tenantID,
			IsTenant:   true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewListTransfersUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListTransfersInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
