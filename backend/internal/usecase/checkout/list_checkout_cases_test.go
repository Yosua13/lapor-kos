package checkout_test

import (
	"context"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestListCheckoutCasesUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	tenantID := uuid.New()

	t.Run("success property list", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewListCheckoutCasesUseCase(mockRepo)

		expected := &checkout.CheckoutListResponse{TotalItems: 1}
		filter := checkout.CheckoutListFilter{Status: "submitted"}
		mockRepo.On("ListCheckoutCases", ctx, propID, filter).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListCheckoutCasesInput{
			PropertyID: propID,
			Filter:     filter,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("success tenant list", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewListCheckoutCasesUseCase(mockRepo)

		expected := []checkout.CheckoutCase{{ID: uuid.New(), TenantID: tenantID}}
		mockRepo.On("ListCheckoutCasesForTenant", ctx, tenantID).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.ListCheckoutCasesInput{
			TenantID: tenantID,
			IsTenant: true,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockCheckoutRepository)
		uc := usecase.NewListCheckoutCasesUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.ListCheckoutCasesInput{PropertyID: uuid.Nil})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
