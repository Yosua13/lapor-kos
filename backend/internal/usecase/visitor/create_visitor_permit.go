package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type CreateVisitorPermitInput struct {
	Permit *visitor.VisitorPermit
}

type CreateVisitorPermitUseCase struct {
	repo visitor.Repository
}

func NewCreateVisitorPermitUseCase(repo visitor.Repository) *CreateVisitorPermitUseCase {
	return &CreateVisitorPermitUseCase{repo: repo}
}

func (uc *CreateVisitorPermitUseCase) Execute(ctx context.Context, input CreateVisitorPermitInput) (*visitor.VisitorPermit, error) {
	if input.Permit == nil {
		return nil, errors.New("permit payload is required")
	}
	if input.Permit.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Permit.GuestName == "" {
		return nil, errors.New("guest name is required")
	}
	return uc.repo.Create(ctx, input.Permit)
}
