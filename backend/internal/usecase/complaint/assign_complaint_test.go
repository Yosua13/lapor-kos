package complaint_test

import (
	"context"
	"errors"
	"testing"

	complaintuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestAssignComplaintUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	propID := uuid.New()
	assigneeID := uuid.New()
	actorID := uuid.New()
	notes := "Please inspect plumbing"

	t.Run("success", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewAssignComplaintUseCase(repo)

		repo.On("Assign", ctx, compID, propID, &assigneeID, &actorID, "Admin", "ADMIN", &notes).Return(nil)

		err := uc.Execute(ctx, complaintuc.AssignComplaintInput{
			ID:         compID,
			PropertyID: propID,
			AssignedTo: &assigneeID,
			ActorID:    &actorID,
			ActorName:  "Admin",
			ActorRole:  "ADMIN",
			Notes:      &notes,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewAssignComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.AssignComplaintInput{
			PropertyID: propID,
		})
		assert.EqualError(t, err, "complaint ID is required")
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewAssignComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.AssignComplaintInput{
			ID: compID,
		})
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewAssignComplaintUseCase(repo)

		repo.On("Assign", ctx, compID, propID, (*uuid.UUID)(nil), (*uuid.UUID)(nil), "", "", (*string)(nil)).Return(errors.New("db error"))

		err := uc.Execute(ctx, complaintuc.AssignComplaintInput{
			ID:         compID,
			PropertyID: propID,
		})
		assert.EqualError(t, err, "db error")
	})
}
