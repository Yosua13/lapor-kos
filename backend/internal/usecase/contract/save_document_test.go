package contract_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	contractuc "github.com/Yosua13/lapor-kos/backend/internal/usecase/contract"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestSaveDocumentUseCase_Execute(t *testing.T) {
	ctx := context.Background()
	propID := uuid.New()
	contractID := uuid.New()
	versionID := uuid.New()
	actorID := uuid.New()
	content := []byte("%PDF-1.4 contract content")

	t.Run("success", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		expected := &contract.ContractDocument{ID: uuid.New(), FileName: "contract.pdf"}
		repo.On("SaveDocument", ctx, propID, contractID, versionID, actorID, 1, "contract.pdf", "sha256hash", content).Return(expected, nil)

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			PropertyID: propID,
			ContractID: contractID,
			VersionID:  versionID,
			ActorID:    actorID,
			Version:    1,
			FileName:   "contract.pdf",
			Hash:       "sha256hash",
			Content:    content,
		})
		assert.NoError(t, err)
		assert.Equal(t, expected, doc)
		repo.AssertExpectations(t)
	})

	t.Run("empty property id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			ContractID: contractID,
			FileName:   "contract.pdf",
			Content:    content,
		})
		assert.Nil(t, doc)
		assert.EqualError(t, err, "property ID is required")
	})

	t.Run("empty contract id", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			PropertyID: propID,
			FileName:   "contract.pdf",
			Content:    content,
		})
		assert.Nil(t, doc)
		assert.EqualError(t, err, "contract ID is required")
	})

	t.Run("empty file name", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			PropertyID: propID,
			ContractID: contractID,
			Content:    content,
		})
		assert.Nil(t, doc)
		assert.EqualError(t, err, "filename is required")
	})

	t.Run("empty content", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			PropertyID: propID,
			ContractID: contractID,
			FileName:   "contract.pdf",
		})
		assert.Nil(t, doc)
		assert.EqualError(t, err, "document content is required")
	})

	t.Run("repo error", func(t *testing.T) {
		repo := new(MockContractRepository)
		uc := contractuc.NewSaveDocumentUseCase(repo)

		repo.On("SaveDocument", ctx, propID, contractID, versionID, actorID, 1, "contract.pdf", "sha256hash", content).Return((*contract.ContractDocument)(nil), errors.New("db error"))

		doc, err := uc.Execute(ctx, contractuc.SaveDocumentInput{
			PropertyID: propID,
			ContractID: contractID,
			VersionID:  versionID,
			ActorID:    actorID,
			Version:    1,
			FileName:   "contract.pdf",
			Hash:       "sha256hash",
			Content:    content,
		})
		assert.Nil(t, doc)
		assert.EqualError(t, err, "db error")
	})
}
