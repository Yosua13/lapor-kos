package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNotificationCenterDeliveryMigrationContainsControls(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "025_notification_center_and_delivery.sql"))
	require.NoError(t, err)
	sql := string(content)

	requiredTables := []string{
		"notification_deliveries",
		"in_app_notifications",
		"notification_preferences",
	}
	for _, table := range requiredTables {
		require.Contains(t, sql, table, "migration 025 should define table %s", table)
	}

	requiredControls := []string{
		"notification_outbox_status_check",
		"dedup_key",
		"idx_notification_outbox_dedup",
		"idx_notification_deliveries_outbox",
		"idx_in_app_notifications_user_inbox",
		"uq_notification_preferences_global",
		"uq_notification_preferences_property",
	}
	for _, control := range requiredControls {
		require.Contains(t, sql, control, "migration 025 should contain control %s", control)
	}

	require.NotContains(t, strings.ToUpper(sql), "TRUNCATE TABLE")
	require.NotContains(t, strings.ToUpper(sql), "DROP TABLE")
}
