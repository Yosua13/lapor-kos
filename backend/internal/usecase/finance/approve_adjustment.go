package finance

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	"github.com/google/uuid"
)

type ApproveAdjustmentInput struct {
	PropertyID   uuid.UUID
	AdjustmentID uuid.UUID
	ApproverID   uuid.UUID
	Request      finance.ApproveAdjustmentRequest
}

type ApproveAdjustmentUseCase struct {
	repo finance.Repository
}

func NewApproveAdjustmentUseCase(repo finance.Repository) *ApproveAdjustmentUseCase {
	return &ApproveAdjustmentUseCase{repo: repo}
}

func (uc *ApproveAdjustmentUseCase) Execute(ctx context.Context, input ApproveAdjustmentInput) (*finance.FinancePeriodAdjustment, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.AdjustmentID == uuid.Nil {
		return nil, errors.New("adjustment ID is required")
	}
	if !input.Request.Approved && input.Request.RejectionReason == "" {
		return nil, errors.New("rejection reason is required when rejecting an adjustment")
	}
	return uc.repo.ApproveAdjustment(ctx, input.PropertyID, input.AdjustmentID, input.ApproverID, input.Request)
}
