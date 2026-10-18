package visitor

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
)

type VerifyPassTokenUseCase struct {
	repo visitor.Repository
}

func NewVerifyPassTokenUseCase(repo visitor.Repository) *VerifyPassTokenUseCase {
	return &VerifyPassTokenUseCase{repo: repo}
}

func (uc *VerifyPassTokenUseCase) Execute(ctx context.Context, token string) (*visitor.VisitorPassVerification, error) {
	if token == "" {
		return nil, errors.New("pass token is required")
	}
	return uc.repo.GetByPassToken(ctx, token)
}
