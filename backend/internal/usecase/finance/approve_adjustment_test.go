package finance_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestApproveAdjustmentUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	adjID := uuid.New()
	approverID := uuid.New()

	t.Run("success approve", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewApproveAdjustmentUseCase(mockRepo)

		req := finance.ApproveAdjustmentRequest{Approved: true}
		expected := &finance.FinancePeriodAdjustment{ID: adjID, PropertyID: propID, Status: "approved"}
		mockRepo.On("ApproveAdjustment", ctx, propID, adjID, approverID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ApproveAdjustmentInput{
			PropertyID:   propID,
			AdjustmentID: adjID,
			ApproverID:   approverID,
			Request:      req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing rejection reason on reject", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewApproveAdjustmentUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ApproveAdjustmentInput{
			PropertyID:   propID,
			AdjustmentID: adjID,
			ApproverID:   approverID,
			Request:      finance.ApproveAdjustmentRequest{Approved: false, RejectionReason: ""},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
