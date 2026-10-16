package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type GetReceiptInput struct {
	PaymentID  uuid.UUID
	PropertyID uuid.UUID
	UserID     uuid.UUID
	IsTenant   bool
}

type GetReceiptUseCase struct {
	repo payment.Repository
}

func NewGetReceiptUseCase(repo payment.Repository) *GetReceiptUseCase {
	return &GetReceiptUseCase{repo: repo}
}

func (uc *GetReceiptUseCase) Execute(ctx context.Context, input GetReceiptInput) (*payment.PaymentReceipt, error) {
	if input.PaymentID == uuid.Nil {
		return nil, errors.New("payment ID is required")
	}
	if input.IsTenant {
		if input.UserID == uuid.Nil {
			return nil, errors.New("user ID is required for tenant access")
		}
		return uc.repo.GetReceiptForUser(ctx, input.UserID, input.PaymentID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.GetReceipt(ctx, input.PropertyID, input.PaymentID)
}
