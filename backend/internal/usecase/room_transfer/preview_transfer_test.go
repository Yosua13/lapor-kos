package room_transfer_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/room_transfer"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/room_transfer"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestPreviewTransferUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()
	toRoomID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewPreviewTransferUseCase(mockRepo)

		req := room_transfer.PreviewTransferRequest{
			ToRoomID:      toRoomID,
			EffectiveDate: "2026-11-01",
		}
		expected := &room_transfer.TransferCalculation{ToRoomID: toRoomID, NetTotalAdjustmentMinor: 100000}
		mockRepo.On("PreviewTransfer", ctx, propID, actorID, req, false).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.PreviewTransferInput{
			PropertyID: propID,
			ActorID:    actorID,
			Request:    req,
			IsTenant:   false,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewPreviewTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PreviewTransferInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing to room id", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewPreviewTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PreviewTransferInput{
			PropertyID: propID,
			Request:    room_transfer.PreviewTransferRequest{ToRoomID: uuid.Nil, EffectiveDate: "2026-11-01"},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing effective date", func(t *testing.T) {
		mockRepo := new(MockRoomTransferRepository)
		uc := usecase.NewPreviewTransferUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.PreviewTransferInput{
			PropertyID: propID,
			Request:    room_transfer.PreviewTransferRequest{ToRoomID: toRoomID, EffectiveDate: ""},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
