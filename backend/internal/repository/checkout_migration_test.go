package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckoutInspectionSettlementMigrationContainsIntegrityControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "024_checkout_inspection_settlement.sql"))
	require.NoError(t, err)
	sql := string(content)

	requiredTables := []string{
		"checkout_cases",
		"checkout_inspections",
		"checkout_settlements",
	}
	for _, table := range requiredTables {
		require.Contains(t, sql, table, "migration 024 should define table %s", table)
	}

	requiredControls := []string{
		"uq_checkout_cases_active_contract",
		"checkout_cases_status_check",
		"uq_checkout_settlements_case",
		"guard_checkout_case_terminal_state",
		"checkout_cases_terminal_guard",
		"refund_requests_checkout_fkey",
	}
	for _, control := range requiredControls {
		require.Contains(t, sql, control, "migration 024 should contain control %s", control)
	}

	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}
