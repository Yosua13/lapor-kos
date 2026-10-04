//go:build integration

package repository_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestTenantInvitationLifecycleAndIsolation exercises Epic #41 against a
// disposable, fully migrated PostgreSQL database. It deliberately bypasses all
// delivery providers so automation never sends email or WhatsApp messages.
func TestTenantInvitationLifecycleAndIsolation(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for tenant lifecycle integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect integration database: %v", err)
	}
	defer pool.Close()

	ownerID := uuid.New()
	propertyA, propertyB := uuid.New(), uuid.New()
	mustPoolExec(t, pool, `
		INSERT INTO users (id,name,email,password_hash,role,is_verified,is_active,phone)
		VALUES ($1,'Epic 41 Owner',$2,'test-hash','owner',TRUE,TRUE,'')`, ownerID, "epic41-owner-"+ownerID.String()+"@example.test")
	for _, propertyID := range []uuid.UUID{propertyA, propertyB} {
		mustPoolExec(t, pool, `
			INSERT INTO properties (id,name,address,timezone,currency,status,created_by)
			VALUES ($1,$2,'','Asia/Jakarta','IDR','active',$3)`, propertyID, "Epic 41 "+propertyID.String(), ownerID)
		mustPoolExec(t, pool, `
			INSERT INTO property_memberships (property_id,user_id,role,permissions,status,created_by)
			VALUES ($1,$2,'property_owner','[]'::jsonb,'active',$2)`, propertyID, ownerID)
	}

	repo := repository.NewTenantLifecycleRepository(pool)
	requestA := model.CreateTenantInvitationRequest{
		FullName: "Tenant A", Email: "tenant-a-" + uuid.NewString() + "@example.test",
		Phone: "6281211111111", DeliveryMethod: "email",
	}
	invitationA, err := repo.CreateInvitation(ctx, propertyA, ownerID, requestA, repository.InvitationDigest("token-a"), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create invitation A: %v", err)
	}
	if err = repo.RecordInvitationDelivery(ctx, propertyA, invitationA.TenantProfileID, invitationA.ID, ownerID, "sent", "integration-request"); err != nil {
		t.Fatalf("record invitation delivery: %v", err)
	}

	page, err := repo.ListInvitationPage(ctx, propertyA, 1, 5, "pending", "Tenant A")
	if err != nil {
		t.Fatalf("list paginated invitations: %v", err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].DeliveryStatus != "sent" {
		t.Fatalf("unexpected invitation page: %+v", page)
	}

	requestB := model.CreateTenantInvitationRequest{
		FullName: "Tenant B", Email: "tenant-b-" + uuid.NewString() + "@example.test",
		Phone: "6281222222222", DeliveryMethod: "whatsapp",
	}
	invitationB, err := repo.CreateInvitation(ctx, propertyA, ownerID, requestB, repository.InvitationDigest("token-b"), time.Now().Add(time.Hour))
	if err != nil {
		t.Fatalf("create invitation B: %v", err)
	}
	_, err = repo.CreateInvitation(ctx, propertyA, ownerID, model.CreateTenantInvitationRequest{
		FullName: "Conflict", Email: requestA.Email, Phone: requestB.Phone, DeliveryMethod: "email",
	}, repository.InvitationDigest("token-conflict"), time.Now().Add(time.Hour))
	if !errors.Is(err, repository.ErrInvitationContactConflict) {
		t.Fatalf("contact conflict error = %v, want ErrInvitationContactConflict", err)
	}

	activation, err := repo.ActivateInvitation(ctx, repository.ActivationInput{
		TokenDigest: repository.InvitationDigest("token-a"), PasswordHash: "hashed-by-handler",
		VerificationKey: "verification-key", Email: requestA.Email, PolicyVersion: "2026-10",
		SourceIP: "127.0.0.1", UserAgent: "integration-test",
	})
	if err != nil {
		t.Fatalf("activate invitation: %v", err)
	}
	if !activation.NewAccount || !activation.RequiresVerification {
		t.Fatalf("unexpected activation result: %+v", activation)
	}
	if _, err = repo.ActivateInvitation(ctx, repository.ActivationInput{TokenDigest: repository.InvitationDigest("token-a")}); !errors.Is(err, repository.ErrInvitationUnavailable) {
		t.Fatalf("replayed activation error = %v, want ErrInvitationUnavailable", err)
	}

	var contactMethod string
	var acceptedAudit, consentCount int
	if err = pool.QueryRow(ctx, `SELECT verified_contact_method FROM tenant_profiles WHERE id=$1 AND property_id=$2`, invitationA.TenantProfileID, propertyA).Scan(&contactMethod); err != nil {
		t.Fatalf("read verified contact: %v", err)
	}
	if contactMethod != "email" {
		t.Fatalf("verified contact method = %q, want email", contactMethod)
	}
	if err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM tenant_consent_records WHERE tenant_profile_id=$1`, invitationA.TenantProfileID).Scan(&consentCount); err != nil || consentCount != 1 {
		t.Fatalf("consent count = %d, err=%v", consentCount, err)
	}
	if err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM tenant_lifecycle_audit_logs WHERE invitation_id=$1 AND action='invitation_accepted'`, invitationA.ID).Scan(&acceptedAudit); err != nil || acceptedAudit != 1 {
		t.Fatalf("accepted audit count = %d, err=%v", acceptedAudit, err)
	}

	if _, err = pool.Exec(ctx, `UPDATE tenant_lifecycle_audit_logs SET action='invitation_revoked' WHERE invitation_id=$1`, invitationA.ID); err == nil {
		t.Fatal("lifecycle audit history unexpectedly allowed an update")
	}
	if _, err = pool.Exec(ctx, `
		INSERT INTO tenant_invitations
			(property_id,tenant_profile_id,token_digest,status,expires_at,created_by,delivery_method)
		VALUES ($1,$2,$3,'pending',NOW()+INTERVAL '1 hour',$4,'email')`,
		propertyB, invitationB.TenantProfileID, repository.InvitationDigest("cross-property"), ownerID); err == nil {
		t.Fatal("cross-property invitation unexpectedly bypassed the composite foreign key")
	}
}

func mustPoolExec(t *testing.T, pool *pgxpool.Pool, query string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), query, args...); err != nil {
		t.Fatalf("execute integration setup: %v\nquery: %s", err, query)
	}
}
