package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetRoomHistoryUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewGetRoomHistoryUseCase(mockRepo)

		expected := []room_transfer.TenantRoomHistoryItem{{ID: uuid.New(), RoomNumber: "101"}}
		mockRepo.On("GetTenantRoomHistory", ctx, propID, tenantID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetRoomHistoryInput{
			PropertyID: propID,
			TenantID:   tenantID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing tenant id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewGetRoomHistoryUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetRoomHistoryInput{TenantID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
