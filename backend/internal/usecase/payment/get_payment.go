package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type GetPaymentInput struct {
	ID         uuid.UUID
	PropertyID uuid.UUID
	UserID     uuid.UUID
	IsTenant   bool
}

type GetPaymentUseCase struct {
	repo payment.Repository
}

func NewGetPaymentUseCase(repo payment.Repository) *GetPaymentUseCase {
	return &GetPaymentUseCase{repo: repo}
}

func (uc *GetPaymentUseCase) Execute(ctx context.Context, input GetPaymentInput) (*payment.Payment, error) {
	if input.ID == uuid.Nil {
		return nil, errors.New("payment ID is required")
	}
	if input.IsTenant {
		if input.UserID == uuid.Nil {
			return nil, errors.New("user ID is required for tenant access")
		}
		return uc.repo.FindByIDForUser(ctx, input.ID, input.UserID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required for property access")
	}
	return uc.repo.FindByID(ctx, input.ID, input.PropertyID)
}
