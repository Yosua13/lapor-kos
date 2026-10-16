package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type GetComplaintInput struct {
	ID         uuid.UUID
	PropertyID uuid.UUID
	UserID     uuid.UUID
	IsTenant   bool
}

type GetComplaintUseCase struct {
	repo complaint.Repository
}

func NewGetComplaintUseCase(repo complaint.Repository) *GetComplaintUseCase {
	return &GetComplaintUseCase{repo: repo}
}

func (uc *GetComplaintUseCase) Execute(ctx context.Context, input GetComplaintInput) (*complaint.Complaint, error) {
	if input.ID == uuid.Nil {
		return nil, errors.New("complaint ID is required")
	}
	if input.IsTenant {
		if input.UserID == uuid.Nil {
			return nil, errors.New("user ID is required for tenant access")
		}
		return uc.repo.FindByTenantAndID(ctx, input.ID, input.UserID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required for property access")
	}
	return uc.repo.FindByID(ctx, input.ID, input.PropertyID)
}
