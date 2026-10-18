package checkout

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
)

type RecordInspectionsInput struct {
	PropertyID uuid.UUID
	CheckoutID uuid.UUID
	ActorID    uuid.UUID
	Request    checkout.RecordInspectionRequest
}

type RecordInspectionsUseCase struct {
	repo checkout.Repository
}

func NewRecordInspectionsUseCase(repo checkout.Repository) *RecordInspectionsUseCase {
	return &RecordInspectionsUseCase{repo: repo}
}

func (uc *RecordInspectionsUseCase) Execute(ctx context.Context, input RecordInspectionsInput) (*checkout.CheckoutCase, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.CheckoutID == uuid.Nil {
		return nil, errors.New("checkout case ID is required")
	}
	return uc.repo.RecordInspections(ctx, input.PropertyID, input.CheckoutID, input.ActorID, input.Request)
}
