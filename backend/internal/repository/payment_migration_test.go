package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPaymentVerificationReconciliationMigrationContainsIntegrityControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "022_payment_verification_reconciliation.sql"))
	require.NoError(t, err)
	sql := string(content)

	requiredTables := []string{
		"payment_proofs",
		"payment_receipts",
		"tenant_credits",
		"refund_requests",
		"notification_outbox",
	}
	for _, table := range requiredTables {
		require.Contains(t, sql, table, "migration 022 should define table %s", table)
	}

	requiredControls := []string{
		"uq_payments_provider_ref",
		"reject_receipt_mutation",
		"reject_credit_mutation",
		"payment_receipts_guard",
		"tenant_credits_guard",
		"sync_invoice_status_on_allocation",
		"invoice_allocations_sync_status",
	}
	for _, control := range requiredControls {
		require.Contains(t, sql, control, "migration 022 should contain control %s", control)
	}

	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}
