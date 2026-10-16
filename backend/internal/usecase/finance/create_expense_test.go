package finance_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/finance"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/finance"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestCreateExpenseUseCase(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	creatorID := uuid.New()

	t.Run("success", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateExpenseUseCase(mockRepo)

		req := finance.CreateExpenseRequest{
			Title:       "Monthly Wifi",
			AmountMinor: 350000,
			Category:    "internet",
		}
		expected := &finance.Expense{
			ID:          uuid.New(),
			PropertyID:  propID,
			Title:       "Monthly Wifi",
			AmountMinor: 350000,
		}

		mockRepo.On("CreateExpense", ctx, propID, creatorID, req).Return(expected, nil)

		res, err := uc.Execute(ctx, usecase.CreateExpenseInput{
			PropertyID: propID,
			CreatorID:  creatorID,
			Request:    req,
		})

		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		mockRepo.AssertExpectations(t)
	})

	t.Run("missing property id", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateExpenseInput{
			PropertyID: uuid.Nil,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("zero amount", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateExpenseUseCase(mockRepo)

		res, err := uc.Execute(ctx, usecase.CreateExpenseInput{
			PropertyID: propID,
			Request: finance.CreateExpenseRequest{
				Title:       "Valid Title",
				AmountMinor: 0,
			},
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})

	t.Run("repository error", func(t *testing.T) {
		mockRepo := new(MockFinanceRepository)
		uc := usecase.NewCreateExpenseUseCase(mockRepo)

		req := finance.CreateExpenseRequest{
			Title:       "Plumbing",
			AmountMinor: 150000,
		}
		mockRepo.On("CreateExpense", ctx, propID, creatorID, req).Return(nil, errors.New("db error"))

		res, err := uc.Execute(ctx, usecase.CreateExpenseInput{
			PropertyID: propID,
			CreatorID:  creatorID,
			Request:    req,
		})
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}
