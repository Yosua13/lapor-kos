package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFinanceMigration029File(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "029_property_finance_expenses_and_reports.sql"))
	if err != nil {
		t.Fatalf("failed to read 029_property_finance_expenses_and_reports.sql: %v", err)
	}

	sqlStr := string(content)

	requiredSnippets := []string{
		"CREATE TABLE IF NOT EXISTS finance_period_closures",
		"CREATE TABLE IF NOT EXISTS expenses",
		"CREATE TABLE IF NOT EXISTS finance_period_adjustments",
		"CREATE TABLE IF NOT EXISTS finance_period_adjustment_events",
		"CREATE TABLE IF NOT EXISTS finance_export_jobs",
		"uq_finance_period_property",
		"uq_expenses_property_number",
		"uq_finance_adjustment_number",
		"idx_finance_period_property",
		"idx_expenses_property",
		"idx_expenses_date",
		"idx_finance_adj_period",
		"idx_finance_adj_events",
		"idx_finance_export_property",
		"protect_approved_finance_adjustment",
		"trg_protect_approved_finance_adjustment",
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(sqlStr, snippet) {
			t.Errorf("migration 029 missing required snippet: %s", snippet)
		}
	}
}
