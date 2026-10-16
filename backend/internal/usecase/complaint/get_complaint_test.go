package complaint_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetComplaintUseCase(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success property view", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewGetComplaintUseCase(mockRepo)

		expected := &complaint.Complaint{ID: compID, PropertyID: propID}
		mockRepo.On("FindByID", ctx, compID, propID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetComplaintInput{
			ID:         compID,
			PropertyID: propID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant view", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewGetComplaintUseCase(mockRepo)

		expected := &complaint.Complaint{ID: compID, UserID: userID}
		mockRepo.On("FindByTenantAndID", ctx, compID, userID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetComplaintInput{
			ID:       compID,
			UserID:   userID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing complaint id", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewGetComplaintUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetComplaintInput{ID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
