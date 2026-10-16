package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRuleMigration028File(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "028_versioned_rules_and_acknowledgments.sql"))
	if err != nil {
		t.Fatalf("failed to read 028_versioned_rules_and_acknowledgments.sql: %v", err)
	}

	sqlStr := string(content)

	requiredSnippets := []string{
		"CREATE TABLE IF NOT EXISTS rule_sets",
		"CREATE TABLE IF NOT EXISTS rule_versions",
		"CREATE TABLE IF NOT EXISTS rule_items",
		"CREATE TABLE IF NOT EXISTS rule_acknowledgments",
		"ALTER TABLE contracts",
		"rule_version_id",
		"rule_acknowledged_at",
		"idx_rule_sets_property",
		"idx_rule_versions_property_status",
		"idx_rule_items_version_order",
		"idx_rule_ack_property_tenant",
		"uq_rule_versions_draft",
		"uq_rule_versions_published",
		"uq_rule_ack_contract",
		"reject_rule_acknowledgment_mutation",
		"enforce_rule_version_immutability",
		"enforce_rule_item_immutability",
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(sqlStr, snippet) {
			t.Errorf("migration 028 missing required snippet: %s", snippet)
		}
	}
}
