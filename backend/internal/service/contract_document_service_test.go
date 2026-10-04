package service

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestContractDocumentContainsPDFAndMatchingHash(t *testing.T) {
	t.Parallel()
	contractID := uuid.New()
	version := model.ContractVersion{
		ID: uuid.New(), ContractID: contractID, VersionNumber: 2,
		Snapshot: []byte(`{"contract_id":"` + contractID.String() + `","monthly_rent":1500000,"status":"active"}`),
	}
	content, digest, err := NewContractDocumentService().Generate(version, model.Contract{ID: contractID})
	require.NoError(t, err)
	require.Greater(t, len(content), 500)
	require.Equal(t, "%PDF", string(content[:4]))
	sum := sha256.Sum256(content)
	require.Equal(t, hex.EncodeToString(sum[:]), digest)
}

func TestContractDocumentRejectsInvalidSnapshot(t *testing.T) {
	t.Parallel()
	_, _, err := NewContractDocumentService().Generate(model.ContractVersion{Snapshot: []byte(`{`)}, model.Contract{})
	require.Error(t, err)
}
