package complaint_test

import (
	"context"
	"errors"
	"testing"

	complaintuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestReopenComplaintUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	userID := uuid.New()
	reason := "Issue recurring after rain"

	t.Run("success", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewReopenComplaintUseCase(repo)

		repo.On("TenantReopen", ctx, compID, userID, reason).Return(nil)

		err := uc.Execute(ctx, complaintuc.ReopenComplaintInput{
			ID:     compID,
			UserID: userID,
			Reason: reason,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewReopenComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.ReopenComplaintInput{
			UserID: userID,
			Reason: reason,
		})
		assert.EqualError(t, err, "complaint ID is required")
	})

	t.Run("empty user id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewReopenComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.ReopenComplaintInput{
			ID:     compID,
			Reason: reason,
		})
		assert.EqualError(t, err, "user ID is required")
	})

	t.Run("empty reason", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewReopenComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.ReopenComplaintInput{
			ID:     compID,
			UserID: userID,
		})
		assert.EqualError(t, err, "reason is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewReopenComplaintUseCase(repo)

		repo.On("TenantReopen", ctx, compID, userID, reason).Return(errors.New("db error"))

		err := uc.Execute(ctx, complaintuc.ReopenComplaintInput{
			ID:     compID,
			UserID: userID,
			Reason: reason,
		})
		assert.EqualError(t, err, "db error")
	})
}
