package contract

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
)

type SaveDocumentInput struct {
	PropertyID uuid.UUID
	ContractID uuid.UUID
	VersionID  uuid.UUID
	ActorID    uuid.UUID
	Version    int
	FileName   string
	Hash       string
	Content    []byte
}

type SaveDocumentUseCase struct {
	repo contract.Repository
}

func NewSaveDocumentUseCase(repo contract.Repository) *SaveDocumentUseCase {
	return &SaveDocumentUseCase{repo: repo}
}

func (uc *SaveDocumentUseCase) Execute(ctx context.Context, input SaveDocumentInput) (*contract.ContractDocument, error) {
	if input.PropertyID == uuid.Nil {
		return nil, errors.New("property ID is required")
	}
	if input.ContractID == uuid.Nil {
		return nil, errors.New("contract ID is required")
	}
	if input.FileName == "" {
		return nil, errors.New("filename is required")
	}
	if len(input.Content) == 0 {
		return nil, errors.New("document content is required")
	}
	return uc.repo.SaveDocument(ctx, input.PropertyID, input.ContractID, input.VersionID, input.ActorID, input.Version, input.FileName, input.Hash, input.Content)
}
