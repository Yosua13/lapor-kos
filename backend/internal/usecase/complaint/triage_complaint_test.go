package complaint_test

import (
	"context"
	"errors"
	"testing"
	"time"

	complaintuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestTriageComplaintUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	compID := uuid.New()
	propID := uuid.New()
	actorID := uuid.New()
	now := time.Now()
	due1 := now.Add(2 * time.Hour)
	due2 := now.Add(24 * time.Hour)
	accessWindow := "09:00 - 12:00"
	reason := "Urgent leak"

	t.Run("success", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		repo.On("Triage", ctx, compID, propID, "HIGH", "SEVERE", &accessWindow, &due1, &due2, &actorID, "Admin", "ADMIN", &reason).Return(nil)

		err := uc.Execute(ctx, complaintuc.TriageInput{
			ID:               compID,
			PropertyID:       propID,
			Priority:         "HIGH",
			Impact:           "SEVERE",
			AccessWindow:     &accessWindow,
			FirstResponseDue: &due1,
			ResolutionDue:    &due2,
			ActorID:          &actorID,
			ActorName:        "Admin",
			ActorRole:        "ADMIN",
			Reason:           &reason,
		})
		assert.NoError(t, err)
		repo.AssertExpectations(t)
	})

	t.Run("empty id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.TriageInput{
			PropertyID: propID,
			Priority:   "HIGH",
			Impact:     "SEVERE",
		})
		assert.EqualError(t, err, "complaint ID is required")
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.TriageInput{
			ID:       compID,
			Priority: "HIGH",
			Impact:   "SEVERE",
		})
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty priority", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.TriageInput{
			ID:         compID,
			PropertyID: propID,
			Impact:     "SEVERE",
		})
		assert.EqualError(t, err, "priority is required")
	})

	t.Run("empty impact", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		err := uc.Execute(ctx, complaintuc.TriageInput{
			ID:         compID,
			PropertyID: propID,
			Priority:   "HIGH",
		})
		assert.EqualError(t, err, "impact is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockComplaintRepository)
		uc := complaintuc.NewTriageComplaintUseCase(repo)

		repo.On("Triage", ctx, compID, propID, "HIGH", "SEVERE", (*string)(nil), (*time.Time)(nil), (*time.Time)(nil), (*uuid.UUID)(nil), "", "", (*string)(nil)).Return(errors.New("db error"))

		err := uc.Execute(ctx, complaintuc.TriageInput{
			ID:         compID,
			PropertyID: propID,
			Priority:   "HIGH",
			Impact:     "SEVERE",
		})
		assert.EqualError(t, err, "db error")
	})
}
