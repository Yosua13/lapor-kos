package complaint_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreateComplaintUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	userID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewCreateComplaintUseCase(mockRepo)

		c := &complaint.Complaint{
			PropertyID:  propID,
			UserID:      userID,
			Title:       "AC Broken",
			Description: "AC not cooling",
		}
		mockRepo.On("Create", ctx, c).Return(nil)

		res, err := uc.Execute(ctx, usecase.CreateComplaintInput{Complaint: c})

		assert.NoError(t, err)
		assert.Equal(t, c, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("nil payload", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewCreateComplaintUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateComplaintInput{Complaint: nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewCreateComplaintUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateComplaintInput{
			Complaint: &complaint.Complaint{
				PropertyID:  uuid.Nil,
				Title:       "AC Broken",
				Description: "AC not cooling",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing title", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewCreateComplaintUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateComplaintInput{
			Complaint: &complaint.Complaint{
				PropertyID:  propID,
				Title:       "",
				Description: "AC not cooling",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("missing description", func(t *testing.T) {
		mockRepo := new(MockComplaintRepository)
		uc := usecase.NewCreateComplaintUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateComplaintInput{
			Complaint: &complaint.Complaint{
				PropertyID:  propID,
				Title:       "AC Broken",
				Description: "",
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
