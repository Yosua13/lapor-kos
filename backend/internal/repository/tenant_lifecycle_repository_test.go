package repository

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInvitationDigestDoesNotPersistRawToken(t *testing.T) {
	raw := "tenant-invitation-secret"
	digest := InvitationDigest(raw)
	if digest == raw || strings.Contains(digest, raw) {
		t.Fatal("invitation digest exposes the raw token")
	}
	if len(digest) != 64 {
		t.Fatalf("digest length = %d, want 64", len(digest))
	}
	if digest != InvitationDigest("  "+raw+"  ") {
		t.Fatal("digest must normalize surrounding whitespace consistently")
	}
}

func TestTenantLifecycleHardeningMigrationContainsSafetyControls(t *testing.T) {
	path := filepath.Join("..", "..", "migrations", "019_harden_tenant_lifecycle.sql")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read hardening migration: %v", err)
	}
	sql := string(content)
	for _, required := range []string{
		"tenant_invitations_profile_property_fk",
		"tenant_documents_file_property_fk",
		"tenant_lifecycle_audit_logs",
		"prevent_tenant_history_mutation",
		"delivery_status",
		"contact_verified_at",
	} {
		if !strings.Contains(sql, required) {
			t.Fatalf("migration is missing %q", required)
		}
	}
	for _, destructive := range []string{"DROP TABLE", "TRUNCATE TABLE"} {
		if strings.Contains(strings.ToUpper(sql), destructive) {
			t.Fatalf("migration contains destructive statement %q", destructive)
		}
	}
}
