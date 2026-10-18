package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type CreatePaymentInput struct {
	Payment *payment.Payment
}

type CreatePaymentUseCase struct {
	repo payment.Repository
}

func NewCreatePaymentUseCase(repo payment.Repository) *CreatePaymentUseCase {
	return &CreatePaymentUseCase{repo: repo}
}

func (uc *CreatePaymentUseCase) Execute(ctx context.Context, input CreatePaymentInput) (*payment.Payment, error) {
	if input.Payment == nil {
		return nil, errors.New("payment payload is required")
	}
	if input.Payment.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.Payment.ContractID == uuid.Nil {
		return nil, errors.New("contract ID is required")
	}
	if err := uc.repo.Create(ctx, input.Payment); err != nil {
		return nil, err
	}
	return input.Payment, nil
}
