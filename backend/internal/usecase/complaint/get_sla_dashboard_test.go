package complaint_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	complaintuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetSLADashboardUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()

	t.Run("success", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewGetSLADashboardUseCase(repo)

		expectedStats := &complaint.SLADashboardStats{
			TotalComplaints: 10,
		}
		repo.On("GetSLADashboardStats", ctx, propID).Return(expectedStats, nil)

		res, err := uc.Execute(ctx, propID)
		assert.NoError(t, err)
		assert.Equal(t, expectedStats, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewGetSLADashboardUseCase(repo)

		res, err := uc.Execute(ctx, uuid.Nil)
		assert.Nil(t, res)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewGetSLADashboardUseCase(repo)

		repo.On("GetSLADashboardStats", ctx, propID).Return(nil, errors.New("db error"))

		res, err := uc.Execute(ctx, propID)
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
