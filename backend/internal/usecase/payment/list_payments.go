package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
)

type ListPaymentsInput struct {
	PropertyID uuid.UUID
	UserID     uuid.UUID
	IsTenant   bool
	Status     string
	Month      int
	Year       int
	ContractID string
	UserIDStr  string
}

type ListPaymentsUseCase struct {
	repo payment.Repository
}

func NewListPaymentsUseCase(repo payment.Repository) *ListPaymentsUseCase {
	return &ListPaymentsUseCase{repo: repo}
}

func (uc *ListPaymentsUseCase) Execute(ctx context.Context, input ListPaymentsInput) ([]payment.Payment, error) {
	if input.IsTenant {
		if input.UserID == uuid.Nil {
			return nil, errors.New("user ID is required for tenant list")
		}
		return uc.repo.FindByUserID(ctx, input.UserID)
	}
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	return uc.repo.FindAll(ctx, input.PropertyID, input.Status, input.Month, input.Year, input.ContractID, input.UserIDStr)
}
