package complaint_test

import (
	"context"
	"testing"

	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUpdateStatusUseCase(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	propID := uuid.New()
	actorID := uuid.New()
	notes := "Investigating"

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewUpdateStatusUseCase(mockRepo)

		mockRepo.On("UpdateStatus", ctx, compID, propID, "in_progress", &actorID, "Admin", "owner", &notes).Return(nil)

		err := uc.Execute(ctx, usecase.UpdateStatusInput{
			ID:         compID,
			PropertyID: propID,
			Status:     "in_progress",
			ActorID:    &actorID,
			ActorName:  "Admin",
			ActorRole:  "owner",
			Notes:      &notes,
		})

		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing status", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewUpdateStatusUseCase(mockRepo)

		err := uc.Execute(ctx, usecase.UpdateStatusInput{
			ID:         compID,
			PropertyID: propID,
			Status:     "",
		})
		assert.Error(t, err)
	})
}
