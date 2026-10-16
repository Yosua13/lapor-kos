package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestGetCheckoutCaseUseCase(t *testing.T) {
	ctx := context.Background()
	caseID := uuid.New()
	propID := uuid.New()
	tenantID := uuid.New()

	t.Run("success property view", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewGetCheckoutCaseUseCase(mockRepo)

		expected := &checkout.CheckoutCase{ID: caseID, PropertyID: propID}
		mockRepo.On("GetCheckoutCase", ctx, propID, caseID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetCheckoutCaseInput{
			ID:         caseID,
			PropertyID: propID,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant view", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewGetCheckoutCaseUseCase(mockRepo)

		expected := &checkout.CheckoutCase{ID: caseID, TenantID: tenantID}
		mockRepo.On("GetCheckoutCaseForTenant", ctx, tenantID, caseID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.GetCheckoutCaseInput{
			ID:       caseID,
			TenantID: tenantID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing case id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewGetCheckoutCaseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.GetCheckoutCaseInput{ID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
