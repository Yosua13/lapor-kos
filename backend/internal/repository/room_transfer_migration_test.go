package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRoomTransferWorkflowMigrationContainsIntegrityControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "023_room_transfer_workflow.sql"))
	require.NoError(t, err)
	sql := string(content)

	requiredTables := []string{
		"room_transfers",
	}
	for _, table := range requiredTables {
		require.Contains(t, sql, table, "migration 023 should define table %s", table)
	}

	requiredControls := []string{
		"room_transfers_target_no_overlap",
		"room_transfers_diff_rooms",
		"room_transfers_dates_check",
		"guard_room_transfer_terminal_state",
		"room_transfers_terminal_state_guard",
	}
	for _, control := range requiredControls {
		require.Contains(t, sql, control, "migration 023 should contain control %s", control)
	}

	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}
