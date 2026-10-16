package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreateCheckoutNoticeUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCreateCheckoutNoticeUseCase(mockRepo)

		req := checkout.CreateCheckoutNoticeRequest{
			ContractID:            uuid.New().String(),
			ScheduledCheckoutDate: "2026-11-15",
			Reason:                "Graduating",
		}
		expected := &checkout.CheckoutCase{ID: uuid.New(), PropertyID: propID, Status: "submitted"}
		mockRepo.On("CreateCheckoutNotice", ctx, propID, actorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.CreateCheckoutNoticeInput{
			PropertyID: propID,
			ActorID:    actorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing contract id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCreateCheckoutNoticeUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateCheckoutNoticeInput{
			PropertyID: propID,
			Request: checkout.CreateCheckoutNoticeRequest{
				ContractID:            "",
				ScheduledCheckoutDate: "2026-11-15",
				Reason:                "Graduating",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing scheduled date", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCreateCheckoutNoticeUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateCheckoutNoticeInput{
			PropertyID: propID,
			Request: checkout.CreateCheckoutNoticeRequest{
				ContractID:            uuid.New().String(),
				ScheduledCheckoutDate: "",
				Reason:                "Graduating",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing reason", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewCreateCheckoutNoticeUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateCheckoutNoticeInput{
			PropertyID: propID,
			Request: checkout.CreateCheckoutNoticeRequest{
				ContractID:            uuid.New().String(),
				ScheduledCheckoutDate: "2026-11-15",
				Reason:                "",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
