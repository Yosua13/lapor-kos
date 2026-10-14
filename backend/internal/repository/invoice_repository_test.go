package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBillingInvoiceMigrationContainsIntegrityControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "021_billing_invoice_engine.sql"))
	require.NoError(t, err)
	sql := string(content)

	requiredTables := []string{
		"billing_policies",
		"invoices",
		"invoice_items",
		"invoice_allocations",
		"invoice_credit_applications",
		"meter_readings",
		"billing_job_runs",
		"invoice_events",
		"billing_job_events",
		"billing_policy_events",
	}
	for _, table := range requiredTables {
		require.Contains(t, sql, table, "migration should define or reference table %s", table)
	}

	requiredControls := []string{
		"recalculate_invoice_total",
		"reject_invoice_history_mutation",
		"guard_invoice_update",
		"invoices_period_unique",
		"invoices_idempotency_property_unique",
		"invoice_items_sign_check",
	}
	for _, control := range requiredControls {
		require.Contains(t, sql, control, "migration should contain control %s", control)
	}

	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}

func TestNormalizePage(t *testing.T) {
	page, size := normalizePage(0, 0)
	require.Equal(t, 1, page)
	require.Equal(t, 10, size)

	page, size = normalizePage(-5, 200)
	require.Equal(t, 1, page)
	require.Equal(t, 100, size)

	page, size = normalizePage(3, 25)
	require.Equal(t, 3, page)
	require.Equal(t, 25, size)
}

func TestShortID(t *testing.T) {
	id := uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
	short := shortID(id)
	require.Equal(t, "A1B2C3D4", short)
	require.Len(t, short, 8)
}
