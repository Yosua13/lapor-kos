package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSecurityMigration030File(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "030_security_audit_and_observability.sql"))
	if err != nil {
		t.Fatalf("failed to read 030_security_audit_and_observability.sql: %v", err)
	}

	sqlStr := string(content)

	requiredSnippets := []string{
		"CREATE TABLE IF NOT EXISTS financial_audit_logs",
		"idx_financial_audit_prop_created",
		"idx_financial_audit_entity",
		"idx_financial_audit_correlation",
		"idx_financial_audit_actor",
		"idx_financial_audit_action",
		"protect_financial_audit_logs",
		"trg_protect_financial_audit_logs",
		"CREATE TABLE IF NOT EXISTS user_session_revocations",
		"idx_user_session_revocations_user",
		"CREATE TABLE IF NOT EXISTS system_health_audit_events",
		"idx_system_health_audit_type",
		"idx_system_health_audit_correlation",
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(sqlStr, snippet) {
			t.Errorf("migration 030 missing required snippet: %s", snippet)
		}
	}
}
