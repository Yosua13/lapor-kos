package complaint_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListComplaintsUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success property complaints", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewListComplaintsUseCase(mockRepo)

		expected := []complaint.Complaint{{ID: uuid.New(), PropertyID: propID, Title: "Water leak"}}
		mockRepo.On("FindByProperty", ctx, propID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListComplaintsInput{PropertyID: propID})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant complaints", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewListComplaintsUseCase(mockRepo)

		expected := []complaint.Complaint{{ID: uuid.New(), UserID: userID, Title: "Noisy neighbor"}}
		mockRepo.On("FindByTenant", ctx, userID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListComplaintsInput{
			UserID:   userID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewListComplaintsUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListComplaintsInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
