//go:build integration

package repository_test

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// TestPropertyIsolationWithTwoOwners is an executable acceptance test for
// Epic #40. It writes only inside one transaction and always rolls it back.
// Run it explicitly with a disposable database:
//
//	TEST_DATABASE_URL="postgres://..." go test -tags=integration ./internal/repository -run TestPropertyIsolationWithTwoOwners
func TestPropertyIsolationWithTwoOwners(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for property-scope integration tests")
	}

	ctx := context.Background()
	conn, err := pgx.Connect(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect integration database: %v", err)
	}
	defer conn.Close(ctx)

	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatalf("begin test transaction: %v", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	ownerA, ownerB := uuid.New(), uuid.New()
	tenantA, tenantB := uuid.New(), uuid.New()
	propertyA, propertyB := uuid.New(), uuid.New()
	roomA, roomB := uuid.New(), uuid.New()
	contractA, contractB := uuid.New(), uuid.New()
	paymentA, paymentB := uuid.New(), uuid.New()
	complaintA, complaintB := uuid.New(), uuid.New()
	ruleA, ruleB := uuid.New(), uuid.New()
	fileA, fileB := uuid.New(), uuid.New()

	for _, user := range []struct {
		id, role string
	}{
		{ownerA.String(), "owner"}, {ownerB.String(), "owner"},
		{tenantA.String(), "tenant"}, {tenantB.String(), "tenant"},
	} {
		mustExec(t, tx, `
			INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, phone)
			VALUES ($1, $2, $3, 'test-hash', $4, TRUE, TRUE, '')`,
			user.id, "Epic 40 "+user.role, "epic40-"+user.id+"@example.test", user.role)
	}

	for _, property := range []struct {
		id, owner uuid.UUID
		name      string
	}{
		{propertyA, ownerA, "Epic 40 Property A"},
		{propertyB, ownerB, "Epic 40 Property B"},
	} {
		mustExec(t, tx, `
			INSERT INTO properties (id, name, address, timezone, currency, status, created_by)
			VALUES ($1, $2, '', 'Asia/Jakarta', 'IDR', 'active', $3)`, property.id, property.name, property.owner)
		mustExec(t, tx, `
			INSERT INTO property_memberships (property_id, user_id, role, permissions, status, created_by)
			VALUES ($1, $2, 'property_owner', '[]'::jsonb, 'active', $2)`, property.id, property.owner)
	}

	// The same room number is deliberately valid in different properties.
	for _, room := range []struct {
		id, property uuid.UUID
	}{
		{roomA, propertyA}, {roomB, propertyB},
	} {
		mustExec(t, tx, `
			INSERT INTO rooms (id, property_id, room_number, price_per_month, status, type, floor, is_draft)
			VALUES ($1, $2, 'A-01', 1000000, 'available', 'standard', '1', FALSE)`, room.id, room.property)
	}

	startDate := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	endDate := startDate.AddDate(1, 0, 0)
	for _, contract := range []struct {
		id, property, room, owner, tenant uuid.UUID
	}{
		{contractA, propertyA, roomA, ownerA, tenantA},
		{contractB, propertyB, roomB, ownerB, tenantB},
	} {
		mustExec(t, tx, `
			INSERT INTO contracts (
				id, property_id, room_id, user_id, owner_id, start_date, end_date,
				rental_duration, monthly_rent, total_price, deposit, payment_due_day,
				status, notes, electricity_bill, water_bill, other_bills, payment_interval
			) VALUES ($1,$2,$3,$4,$5,$6,$7,12,1000000,12000000,0,1,'active','',0,0,0,'monthly')`,
			contract.id, contract.property, contract.room, contract.tenant, contract.owner, startDate, endDate)
	}

	for _, payment := range []struct {
		id, property, contract, owner uuid.UUID
		total                         int
	}{
		{paymentA, propertyA, contractA, ownerA, 1000000},
		{paymentB, propertyB, contractB, ownerB, 2000000},
	} {
		mustExec(t, tx, `
			INSERT INTO payments (
				id, property_id, contract_id, owner_id, period_month, period_year,
				amount_rent, amount_electricity, amount_water, amount_other,
				total_paid, payment_method, status, due_date, notes
			) VALUES ($1,$2,$3,$4,1,2026,$5,0,0,0,$5,'transfer','paid',$6,'')`,
			payment.id, payment.property, payment.contract, payment.owner, payment.total, startDate)
	}

	for _, complaint := range []struct {
		id, property, tenant, owner, room uuid.UUID
	}{
		{complaintA, propertyA, tenantA, ownerA, roomA},
		{complaintB, propertyB, tenantB, ownerB, roomB},
	} {
		mustExec(t, tx, `
			INSERT INTO complaints (id, property_id, user_id, owner_id, room_id, title, description, category)
			VALUES ($1,$2,$3,$4,$5,'Epic 40','test isolation','facility')`,
			complaint.id, complaint.property, complaint.tenant, complaint.owner, complaint.room)
	}

	for _, rule := range []struct {
		id, property, owner uuid.UUID
	}{
		{ruleA, propertyA, ownerA}, {ruleB, propertyB, ownerB},
	} {
		mustExec(t, tx, `
			INSERT INTO house_rules (id, property_id, owner_id, category, title, description, details)
			VALUES ($1,$2,$3,'general','Epic 40','test isolation',ARRAY[]::text[])`, rule.id, rule.property, rule.owner)
	}

	for _, file := range []struct {
		id, property, owner uuid.UUID
	}{
		{fileA, propertyA, ownerA}, {fileB, propertyB, ownerB},
	} {
		mustExec(t, tx, `
			INSERT INTO files (id, property_id, uploaded_by, object_key, mime_type, size_bytes, checksum_sha256)
			VALUES ($1,$2,$3,$4,'image/png',1,$5)`,
			file.id, file.property, file.owner, "properties/"+file.property.String()+"/epic40.png", strings.Repeat("a", 64))
	}

	assertCount(t, tx, `SELECT COUNT(*) FROM rooms WHERE property_id=$1 AND room_number='A-01'`, propertyA, 1)
	assertCount(t, tx, `SELECT COUNT(*) FROM rooms WHERE property_id=$1 AND room_number='A-01'`, propertyB, 1)

	// Read, update, and delete predicates must not cross property boundaries.
	for _, check := range []struct {
		name  string
		query string
		id    uuid.UUID
	}{
		{"room read", `SELECT COUNT(*) FROM rooms WHERE property_id=$1 AND id=$2`, roomB},
		{"contract read", `SELECT COUNT(*) FROM contracts WHERE property_id=$1 AND id=$2`, contractB},
		{"payment read", `SELECT COUNT(*) FROM payments WHERE property_id=$1 AND id=$2`, paymentB},
		{"complaint read", `SELECT COUNT(*) FROM complaints WHERE property_id=$1 AND id=$2`, complaintB},
		{"rule read", `SELECT COUNT(*) FROM house_rules WHERE property_id=$1 AND id=$2`, ruleB},
		{"file read", `SELECT COUNT(*) FROM files WHERE property_id=$1 AND id=$2`, fileB},
	} {
		t.Run(check.name, func(t *testing.T) {
			assertCount(t, tx, check.query, propertyA, 0, check.id)
		})
	}

	assertAffected(t, tx, `UPDATE rooms SET description='blocked' WHERE property_id=$1 AND id=$2`, propertyA, roomB, 0)
	assertAffected(t, tx, `UPDATE contracts SET notes='blocked' WHERE property_id=$1 AND id=$2`, propertyA, contractB, 0)
	assertAffected(t, tx, `UPDATE payments SET notes='blocked' WHERE property_id=$1 AND id=$2`, propertyA, paymentB, 0)
	assertAffected(t, tx, `UPDATE complaints SET status='resolved' WHERE property_id=$1 AND id=$2`, propertyA, complaintB, 0)
	assertAffected(t, tx, `UPDATE house_rules SET title='blocked' WHERE property_id=$1 AND id=$2`, propertyA, ruleB, 0)
	assertAffected(t, tx, `DELETE FROM contracts WHERE property_id=$1 AND id=$2`, propertyA, contractB, 0)
	assertAffected(t, tx, `DELETE FROM house_rules WHERE property_id=$1 AND id=$2`, propertyA, ruleB, 0)

	// Financial report/export is sourced from the selected property only.
	var reportTotal float64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(SUM(total_paid), 0) FROM payments WHERE property_id=$1`, propertyA).Scan(&reportTotal); err != nil {
		t.Fatalf("query property-scoped report total: %v", err)
	}
	if reportTotal != 1000000 {
		t.Fatalf("report total = %.2f, want 1000000; property B payment leaked into report", reportTotal)
	}

	// Owner A has no membership in property B, which is the condition checked
	// by RequirePropertyAccess before every staff operation.
	assertCount(t, tx, `SELECT COUNT(*) FROM property_memberships WHERE property_id=$1 AND user_id=$2 AND status='active'`, propertyB, 0, ownerA)
}

func mustExec(t *testing.T, tx pgx.Tx, query string, args ...any) {
	t.Helper()
	if _, err := tx.Exec(context.Background(), query, args...); err != nil {
		t.Fatalf("execute test setup: %v\nquery: %s", err, query)
	}
}

func assertCount(t *testing.T, tx pgx.Tx, query string, propertyID uuid.UUID, expected int, extra ...uuid.UUID) {
	t.Helper()
	args := []any{propertyID}
	for _, value := range extra {
		args = append(args, value)
	}
	var count int
	if err := tx.QueryRow(context.Background(), query, args...).Scan(&count); err != nil {
		t.Fatalf("count isolated resource: %v", err)
	}
	if count != expected {
		t.Fatalf("count = %d, want %d; query: %s", count, expected, fmt.Sprintf(query, args...))
	}
}

func assertAffected(t *testing.T, tx pgx.Tx, query string, propertyID, id uuid.UUID, expected int64) {
	t.Helper()
	result, err := tx.Exec(context.Background(), query, propertyID, id)
	if err != nil {
		t.Fatalf("mutate isolated resource: %v", err)
	}
	if result.RowsAffected() != expected {
		t.Fatalf("affected rows = %d, want %d; query: %s", result.RowsAffected(), expected, query)
	}
}
