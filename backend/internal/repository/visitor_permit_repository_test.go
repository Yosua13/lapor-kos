package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestVisitorPermitMigration026File(t *testing.T) {
	content, err := os.ReadFile(filepath.Join("..", "..", "migrations", "026_visitor_permit_and_overnight_guest.sql"))
	if err != nil {
		t.Fatalf("failed to read 026_visitor_permit_and_overnight_guest.sql: %v", err)
	}

	sqlStr := string(content)

	requiredSnippets := []string{
		"CREATE TABLE IF NOT EXISTS visitor_permits",
		"CREATE TABLE IF NOT EXISTS visitor_permit_events",
		"idx_visitor_permits_property_status",
		"idx_visitor_permits_tenant",
		"idx_visitor_permits_pass_token",
		"idx_visitor_permits_retention",
		"idx_visitor_permit_events_permit",
		"is_anonymized",
		"pass_token",
		"total_guests",
		"vehicle_type",
		"is_overnight",
	}

	for _, snippet := range requiredSnippets {
		if !strings.Contains(sqlStr, snippet) {
			t.Errorf("migration 026 missing required snippet: %s", snippet)
		}
	}
}

func TestMaskGuestName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"", "Tamu"},
		{"Budi", "B***"},
		{"Budi Santoso", "B*** S***"},
		{"A B C", "A B C"},
		{"Andi Pratama Wijaya", "A*** P*** W***"},
	}

	for _, tc := range tests {
		got := maskGuestName(tc.input)
		if got != tc.want {
			t.Errorf("maskGuestName(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestGeneratePassToken(t *testing.T) {
	token1 := generatePassToken()
	token2 := generatePassToken()

	if !strings.HasPrefix(token1, "VP-") {
		t.Fatalf("token %q does not start with VP-", token1)
	}
	if token1 == token2 {
		t.Fatalf("generated identical tokens: %q and %q", token1, token2)
	}
}
