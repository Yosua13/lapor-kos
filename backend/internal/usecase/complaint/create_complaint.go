package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type CreateComplaintInput struct {
	Complaint *complaint.Complaint
}

type CreateComplaintUseCase struct {
	repo complaint.Repository
}

func NewCreateComplaintUseCase(repo complaint.Repository) *CreateComplaintUseCase {
	return &CreateComplaintUseCase{repo: repo}
}

func (uc *CreateComplaintUseCase) Execute(ctx context.Context, input CreateComplaintInput) (*complaint.Complaint, error) {
	if input.Complaint == nil {
		return nil, errors.New("complaint payload is required")
	}
	if input.Complaint.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Complaint.Title == "" {
		return nil, errors.New("complaint title is required")
	}
	if input.Complaint.Description == "" {
		return nil, errors.New("complaint description is required")
	}
	if err := uc.repo.Create(ctx, input.Complaint); err != nil {
		return nil, err
	}
	return input.Complaint, nil
}
