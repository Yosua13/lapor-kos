package visitor_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	visitoruc "github.com/Yosua13/lapor-kos/backend/internal/usecase/visitor"
	"github.com/stretchr/testify/assert"
)

func TestVerifyPassTokenUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	token := "TOKEN123"

	t.Run("success", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewVerifyPassTokenUseCase(repo)

		expected := &visitor.VisitorPassVerification{PassToken: token}
		repo.On("GetByPassToken", ctx, token).Return(expected, nil)

		res, err := uc.Execute(ctx, token)
		assert.NoError(t, err)
		assert.Equal(t, expected, res)
		repo.AssertExpectations(t)
	})

	t.Run("empty token", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewVerifyPassTokenUseCase(repo)

		res, err := uc.Execute(ctx, "")
		assert.Nil(t, res)
		assert.EqualError(t, err, "pass token is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockVisitorRepository)
		uc := visitoruc.NewVerifyPassTokenUseCase(repo)

		repo.On("GetByPassToken", ctx, token).Return((*visitor.VisitorPassVerification)(nil), errors.New("db error"))

		res, err := uc.Execute(ctx, token)
		assert.Nil(t, res)
		assert.EqualError(t, err, "db error")
	})
}
