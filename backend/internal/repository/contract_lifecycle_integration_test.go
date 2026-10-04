//go:build integration

package repository_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestContractLifecycleIsAtomicScopedAndImmutable(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	ownerID, tenantA, tenantB, propertyID, roomID := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	for _, user := range []struct {
		id         uuid.UUID
		name, role string
	}{{ownerID, "Owner", "owner"}, {tenantA, "Tenant A", "tenant"}, {tenantB, "Tenant B", "tenant"}} {
		mustPoolExec(t, pool, `INSERT INTO users(id,name,email,password_hash,role,is_verified,is_active,phone) VALUES($1,$2,$3,'hash',$4,TRUE,TRUE,'628123456789')`, user.id, user.name, user.id.String()+"@example.test", user.role)
	}
	mustPoolExec(t, pool, `INSERT INTO properties(id,name,address,timezone,currency,status,created_by) VALUES($1,'Lifecycle Test','','Asia/Jakarta','IDR','active',$2)`, propertyID, ownerID)
	mustPoolExec(t, pool, `INSERT INTO property_memberships(property_id,user_id,role,permissions,status,created_by) VALUES($1,$2,'property_owner','[]','active',$2)`, propertyID, ownerID)
	mustPoolExec(t, pool, `INSERT INTO rooms(id,property_id,room_number,price_per_month,status) VALUES($1,$2,'A-01',1500000,'available')`, roomID, propertyID)
	for index, tenantID := range []uuid.UUID{tenantA, tenantB} {
		var profileID uuid.UUID
		phone := fmt.Sprintf("62812345678%d", index)
		mustPoolQueryRow(t, pool, `INSERT INTO tenant_profiles(property_id,user_id,full_name,email,phone,status,created_by,activated_at) VALUES($1,$2,'Tenant',$3,$4,'active',$5,NOW()) RETURNING id`, []any{propertyID, tenantID, tenantID.String() + "@example.test", phone, ownerID}, &profileID)
		fileID := uuid.New()
		mustPoolExec(t, pool, `INSERT INTO files(id,property_id,uploaded_by,object_key,mime_type,size_bytes,checksum_sha256) VALUES($1,$2,$3,$4,'image/jpeg',10,$5)`, fileID, propertyID, ownerID, "integration/"+fileID.String(), "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
		mustPoolExec(t, pool, `INSERT INTO tenant_documents(property_id,tenant_profile_id,file_id,document_type,uploaded_by) VALUES($1,$2,$3,'ktp',$4)`, propertyID, profileID, fileID, ownerID)
	}
	contractRepo := repository.NewContractRepository(pool)
	lifecycle := repository.NewContractLifecycleRepository(pool, contractRepo)
	create := func(tenantID uuid.UUID) *model.Contract {
		start := time.Now().UTC().Truncate(24 * time.Hour)
		contract := &model.Contract{RoomID: &roomID, UserID: &tenantID, StartDate: start, EndDate: start.AddDate(0, 1, 0), RentalDuration: 1, MonthlyRent: 1500000, TotalPrice: 1500000, PaymentInterval: "monthly", PaymentDueDay: 5}
		if err := contractRepo.Create(ctx, propertyID, ownerID, contract); err != nil {
			t.Fatal(err)
		}
		return contract
	}
	first := create(tenantA)
	if err = lifecycle.Transition(ctx, propertyID, ownerID, first.ID, model.ContractPendingTenant, "", nil); err != nil {
		t.Fatal(err)
	}
	if err = lifecycle.AcceptByTenant(ctx, tenantA, first.ID, "127.0.0.1", "integration"); err != nil {
		t.Fatal(err)
	}
	if err = lifecycle.Transition(ctx, propertyID, ownerID, first.ID, model.ContractActive, "", nil); err != nil {
		t.Fatal(err)
	}
	version, _, err := lifecycle.CurrentSnapshot(ctx, propertyID, first.ID)
	if err != nil {
		t.Fatal(err)
	}
	document, err := lifecycle.SaveDocument(ctx, propertyID, first.ID, version.ID, ownerID, version.VersionNumber, "contract.pdf", strings.Repeat("b", 64), []byte("%PDF-test"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err = lifecycle.SaveDocument(ctx, propertyID, first.ID, version.ID, ownerID, version.VersionNumber, "duplicate.pdf", strings.Repeat("c", 64), []byte("%PDF-duplicate")); err == nil {
		t.Fatal("duplicate document version was accepted")
	}
	if _, _, _, err = lifecycle.DocumentContent(ctx, propertyID, first.ID, document.ID, ownerID); err != nil {
		t.Fatal(err)
	}
	tenantPropertyID, err := lifecycle.TenantContract(ctx, tenantA, first.ID)
	if err != nil || tenantPropertyID != propertyID {
		t.Fatalf("tenant document scope property=%s err=%v", tenantPropertyID, err)
	}
	if _, err = lifecycle.TenantContract(ctx, tenantB, first.ID); err == nil {
		t.Fatal("another tenant could resolve the contract document scope")
	}
	second := create(tenantB)
	if err = lifecycle.Transition(ctx, propertyID, ownerID, second.ID, model.ContractPendingTenant, "", nil); err != nil {
		t.Fatal(err)
	}
	if err = lifecycle.AcceptByTenant(ctx, tenantB, second.ID, "127.0.0.1", "integration"); err != nil {
		t.Fatal(err)
	}
	amended := *second
	if err = lifecycle.Amend(ctx, propertyID, ownerID, &amended, "Harga dikonfirmasi ulang"); err != nil {
		t.Fatal(err)
	}
	var amendedStatus string
	if err = pool.QueryRow(ctx, `SELECT status FROM contracts WHERE id=$1`, second.ID).Scan(&amendedStatus); err != nil || amendedStatus != model.ContractPendingTenant {
		t.Fatalf("scheduled amendment status=%q err=%v", amendedStatus, err)
	}
	if err = lifecycle.AcceptByTenant(ctx, tenantB, second.ID, "127.0.0.1", "integration-amendment"); err != nil {
		t.Fatal(err)
	}
	err = lifecycle.Transition(ctx, propertyID, ownerID, second.ID, model.ContractActive, "", nil)
	if !errors.Is(err, repository.ErrContractPrerequisite) {
		t.Fatalf("overlap activation error=%v", err)
	}
	var status string
	var occupancyCount int
	if err = pool.QueryRow(ctx, `SELECT status FROM contracts WHERE id=$1`, second.ID).Scan(&status); err != nil || status != model.ContractScheduled {
		t.Fatalf("failed activation left status=%q err=%v", status, err)
	}
	if err = pool.QueryRow(ctx, `SELECT COUNT(*) FROM occupancy_periods WHERE property_id=$1 AND room_id=$2`, propertyID, roomID).Scan(&occupancyCount); err != nil || occupancyCount != 1 {
		t.Fatalf("occupancy count=%d err=%v", occupancyCount, err)
	}
	if _, err = pool.Exec(ctx, `UPDATE contract_versions SET reason='tampered' WHERE contract_id=$1`, first.ID); err == nil {
		t.Fatal("immutable version accepted an update")
	}
	if _, err = pool.Exec(ctx, `UPDATE contracts SET status='draft' WHERE id=$1`, first.ID); err == nil {
		t.Fatal("illegal database transition was accepted")
	}
}

func mustPoolQueryRow(t *testing.T, pool *pgxpool.Pool, query string, args []any, dest ...any) {
	t.Helper()
	if err := pool.QueryRow(context.Background(), query, args...).Scan(dest...); err != nil {
		t.Fatalf("query integration setup: %v", err)
	}
}
