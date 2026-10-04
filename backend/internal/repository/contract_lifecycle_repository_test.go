package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/stretchr/testify/require"
)

func TestCanTransition(t *testing.T) {
	t.Parallel()
	tests := []struct {
		from, to string
		allowed  bool
	}{
		{model.ContractDraft, model.ContractPendingTenant, true},
		{model.ContractDraft, model.ContractActive, false},
		{model.ContractPendingTenant, model.ContractScheduled, true},
		{model.ContractPendingTenant, model.ContractActive, false},
		{model.ContractScheduled, model.ContractActive, true},
		{model.ContractActive, model.ContractEnded, true},
		{model.ContractActive, model.ContractTerminated, true},
		{model.ContractEnded, model.ContractActive, false},
		{model.ContractCancelled, model.ContractDraft, false},
	}
	for _, test := range tests {
		t.Run(test.from+"_to_"+test.to, func(t *testing.T) {
			require.Equal(t, test.allowed, CanTransition(test.from, test.to))
		})
	}
}

func TestContractLifecycleMigrationContainsIntegrityControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "020_contract_lifecycle.sql"))
	require.NoError(t, err)
	sql := string(content)
	for _, required := range []string{"contract_versions", "contract_events", "contract_policy_acceptances", "occupancy_room_no_overlap", "contract_documents", "contracts_status_transition_guard", "reject_contract_history_mutation"} {
		require.Contains(t, sql, required)
	}
	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}

func TestRequireReasonForTerminalTransitions(t *testing.T) {
	t.Parallel()
	require.ErrorIs(t, requireReason(model.ContractTerminated, ""), ErrContractPrerequisite)
	require.NoError(t, requireReason(model.ContractTerminated, "pelanggaran kontrak"))
	require.NoError(t, requireReason(model.ContractPendingTenant, ""))
}
