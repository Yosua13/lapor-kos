package complaint

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
)

type ListComplaintsInput struct {
	PropertyID uuid.UUID
	UserID     uuid.UUID
	IsTenant   bool
}

type ListComplaintsUseCase struct {
	repo complaint.Repository
}

func NewListComplaintsUseCase(repo complaint.Repository) *ListComplaintsUseCase {
	return &ListComplaintsUseCase{repo: repo}
}

func (uc *ListComplaintsUseCase) Execute(ctx context.Context, input ListComplaintsInput) ([]complaint.Complaint, error) {
	if input.IsTenant {
		if input.UserID == uuid.Nil {
			return nil, errors.New("user ID is required for tenant complaint list")
		}
		return uc.repo.FindByTenant(ctx, input.UserID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.FindByProperty(ctx, input.PropertyID)
}
