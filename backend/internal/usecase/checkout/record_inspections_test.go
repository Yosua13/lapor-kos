package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestRecordInspectionsUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	caseID := uuid.New()
	actorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewRecordInspectionsUseCase(mockRepo)

		req := checkout.RecordInspectionRequest{KeyReturned: true, InspectionNotes: "Clean room"}
		expected := &checkout.CheckoutCase{ID: caseID, PropertyID: propID, KeyReturned: true}
		mockRepo.On("RecordInspections", ctx, propID, caseID, actorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.RecordInspectionsInput{
			PropertyID: propID,
			CheckoutID: caseID,
			ActorID:    actorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewRecordInspectionsUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.RecordInspectionsInput{
			PropertyID: uuid.Nil,
			CheckoutID: caseID,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing case id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewRecordInspectionsUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.RecordInspectionsInput{
			PropertyID: propID,
			CheckoutID: uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
