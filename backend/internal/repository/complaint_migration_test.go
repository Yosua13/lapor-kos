package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestComplaintMigration027File(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "027_complaint_sla_work_orders_and_events.sql"))
	if err != nil {
		t.Fatalf("failed to read 027_complaint_sla_work_orders_and_events.sql: %v", err)
	}

	sqlStr := string(content)

	requiredSnippets := []string{
		"ALTER TABLE complaints",
		"priority",
		"impact",
		"access_window",
		"assigned_to",
		"first_response_at",
		"resolved_at",
		"confirmed_resolved_at",
		"first_response_due_at",
		"resolution_due_at",
		"sla_status",
		"CREATE TABLE IF NOT EXISTS complaint_events",
		"CREATE TABLE IF NOT EXISTS vendors",
		"CREATE TABLE IF NOT EXISTS work_orders",
		"CREATE TABLE IF NOT EXISTS ai_suggestions",
		"idx_complaints_property_priority",
		"idx_complaints_property_sla",
		"idx_complaint_events_complaint_id",
		"idx_work_orders_complaint",
		"idx_ai_suggestions_complaint",
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(sqlStr, snippet) {
			t.Errorf("migration 027 missing required snippet: %s", snippet)
		}
	}
}
