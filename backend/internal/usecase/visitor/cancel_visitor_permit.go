package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
)

type CancelVisitorPermitInput struct {
	ID       uuid.UUID
	ActorID  uuid.UUID
	IsTenant bool
	Reason   *string
}

type CancelVisitorPermitUseCase struct {
	repo visitor.Repository
}

func NewCancelVisitorPermitUseCase(repo visitor.Repository) *CancelVisitorPermitUseCase {
	return &CancelVisitorPermitUseCase{repo: repo}
}

func (uc *CancelVisitorPermitUseCase) Execute(ctx context.Context, input CancelVisitorPermitInput) (*visitor.VisitorPermit, error) {
	if input.ID == uuid.Nil {
		return nil, errors.New("permit ID is required")
	}
	return uc.repo.Cancel(ctx, input.ID, input.ActorID, input.IsTenant, input.Reason)
}
