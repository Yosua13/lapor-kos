package complaint_test

import (
	"context"
	"errors"
	"testing"

	complaintuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestConfirmResolutionUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	userID := uuid.New()
	comment := "Resolved perfectly, thanks!"

	t.Run("success", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewConfirmResolutionUseCase(repo)

		repo.On("TenantConfirmResolution", ctx, compID, userID, &comment).Return(nil)

		err := uc.Execute(ctx, complaintuc.ConfirmResolutionInput{
			ID:      compID,
			UserID:  userID,
			Comment: &comment,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewConfirmResolutionUseCase(repo)

		err := uc.Execute(ctx, complaintuc.ConfirmResolutionInput{
			UserID: userID,
		})
		assert.EqualError(t, err, "complaint ID is required")
	})

	t.Run("empty user id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewConfirmResolutionUseCase(repo)

		err := uc.Execute(ctx, complaintuc.ConfirmResolutionInput{
			ID: compID,
		})
		assert.EqualError(t, err, "user ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewConfirmResolutionUseCase(repo)

		repo.On("TenantConfirmResolution", ctx, compID, userID, (*string)(nil)).Return(errors.New("db error"))

		err := uc.Execute(ctx, complaintuc.ConfirmResolutionInput{
			ID:     compID,
			UserID: userID,
		})
		assert.EqualError(t, err, "db error")
	})
}
