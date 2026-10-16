//go:build integration

package repository_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSecurityAuditAndObservabilityLifecycle(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://postgres:postgres@localhost:5432/lapor_kos?sslmode=disable"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Skipf("cannot connect to test database: %v", err)
	}
	defer pool.Close()

	auditRepo := repository.NewSecurityAuditRepository(pool)
	userRepo := repository.NewUserRepository(pool)

	ownerA := uuid.New()
	ownerB := uuid.New()
	propertyA := uuid.New()
	propertyB := uuid.New()

	// Seed Owners & Properties
	mustPoolExec(t, pool, `INSERT INTO users(id, name, email, password_hash, role, is_verified, is_active, phone) VALUES($1, 'Owner A', $2, 'hash', 'owner', TRUE, TRUE, '628111111')`, ownerA, ownerA.String()+"@example.test")
	mustPoolExec(t, pool, `INSERT INTO users(id, name, email, password_hash, role, is_verified, is_active, phone) VALUES($1, 'Owner B', $2, 'hash', 'owner', TRUE, TRUE, '628222222')`, ownerB, ownerB.String()+"@example.test")

	mustPoolExec(t, pool, `INSERT INTO properties(id, name, address, timezone, currency, status, created_by) VALUES($1, 'Property Alpha', 'Jl. Alpha 1', 'Asia/Jakarta', 'IDR', 'active', $2)`, propertyA, ownerA)
	mustPoolExec(t, pool, `INSERT INTO properties(id, name, address, timezone, currency, status, created_by) VALUES($1, 'Property Beta', 'Jl. Beta 2', 'Asia/Jakarta', 'IDR', 'active', $2)`, propertyB, ownerB)

	// =========================================================================
	// AC 3: Financial Audit Trail (Actor, Reason, Time, Correlation ID)
	// =========================================================================
	t.Run("AC 3: Financial audit logging captures full audit context and is immutable", func(t *testing.T) {
		correlationID := "trace-" + uuid.New().String()
		entityID := uuid.New()

		entry := model.FinancialAuditLog{
			PropertyID:    propertyA,
			ActorID:       &ownerA,
			ActorEmail:    "owner-a@example.test",
			ActorRole:     "owner",
			Action:        "payment_verify",
			EntityType:    "payment",
			EntityID:      entityID,
			AmountMinor:   2500000,
			Currency:      "IDR",
			Reason:        "Verifikasi bukti transfer bank Mandiri",
			CorrelationID: correlationID,
			IPAddress:     "192.168.1.100",
			UserAgent:     "Mozilla/5.0 TestAgent",
			BeforeState:   map[string]any{"status": "pending"},
			AfterState:    map[string]any{"status": "paid"},
			Metadata:      map[string]any{"invoice_number": "INV-202610-001"},
		}

		err := auditRepo.RecordFinancialAudit(ctx, entry)
		require.NoError(t, err)

		// List and verify
		res, err := auditRepo.ListFinancialAudits(ctx, model.FinancialAuditFilter{
			PropertyID:    propertyA,
			CorrelationID: correlationID,
			Page:          1,
			PageSize:      10,
		})
		require.NoError(t, err)
		require.NotNil(t, res)
		require.Equal(t, int64(1), res.Total)
		require.Len(t, res.Items, 1)

		item := res.Items[0]
		assert.Equal(t, propertyA, item.PropertyID)
		assert.Equal(t, ownerA, *item.ActorID)
		assert.Equal(t, "payment_verify", item.Action)
		assert.Equal(t, "payment", item.EntityType)
		assert.Equal(t, entityID, item.EntityID)
		assert.Equal(t, int64(2500000), item.AmountMinor)
		assert.Equal(t, "Verifikasi bukti transfer bank Mandiri", item.Reason)
		assert.Equal(t, correlationID, item.CorrelationID)
		assert.False(t, item.CreatedAt.IsZero())

		// Verify Immutability (Reject UPDATE)
		_, err = pool.Exec(ctx, `UPDATE financial_audit_logs SET reason = 'Tampered reason' WHERE id = $1`, item.ID)
		require.Error(t, err, "expected error when updating financial_audit_logs")
		assert.Contains(t, err.Error(), "financial_audit_logs is append-only")

		// Verify Immutability (Reject DELETE)
		_, err = pool.Exec(ctx, `DELETE FROM financial_audit_logs WHERE id = $1`, item.ID)
		require.Error(t, err, "expected error when deleting financial_audit_logs")
		assert.Contains(t, err.Error(), "financial_audit_logs is append-only")
	})

	// =========================================================================
	// AC 2 & Property Scoping: Cross-Owner Multi-Tenant Isolation
	// =========================================================================
	t.Run("AC 2: Cross-owner property scoping prevents data leaks", func(t *testing.T) {
		// Log entry in Property B
		corrB := "trace-beta-" + uuid.New().String()
		err := auditRepo.RecordFinancialAudit(ctx, model.FinancialAuditLog{
			PropertyID:    propertyB,
			ActorID:       &ownerB,
			Action:        "expense_create",
			EntityType:    "expense",
			EntityID:      uuid.New(),
			AmountMinor:   500000,
			Currency:      "IDR",
			Reason:        "Biaya listrik rahasia Property B",
			CorrelationID: corrB,
		})
		require.NoError(t, err)

		// Owner A lists audits for Property A -> must NOT see corrB
		resA, err := auditRepo.ListFinancialAudits(ctx, model.FinancialAuditFilter{
			PropertyID:    propertyA,
			CorrelationID: corrB,
			Page:          1,
			PageSize:      10,
		})
		require.NoError(t, err)
		assert.Equal(t, int64(0), resA.Total)
		assert.Empty(t, resA.Items)

		// Property B lists audits -> sees corrB
		resB, err := auditRepo.ListFinancialAudits(ctx, model.FinancialAuditFilter{
			PropertyID:    propertyB,
			CorrelationID: corrB,
			Page:          1,
			PageSize:      10,
		})
		require.NoError(t, err)
		assert.Equal(t, int64(1), resB.Total)
	})

	// =========================================================================
	// Session Revocation & Policy
	// =========================================================================
	t.Run("Session revocation invalidates tokens issued before revocation time", func(t *testing.T) {
		targetUser := uuid.New()
		mustPoolExec(t, pool, `INSERT INTO users(id, name, email, password_hash, role, is_verified, is_active, phone) VALUES($1, 'Session Target', $2, 'hash', 'staff', TRUE, TRUE, '628333333')`, targetUser, targetUser.String()+"@example.test")

		// Token issued at T1
		t1 := time.Now().Add(-10 * time.Minute)
		validBefore, err := userRepo.IsSessionValid(ctx, targetUser, t1)
		require.NoError(t, err)
		assert.True(t, validBefore, "session should be valid initially")

		// Revoke session at T2 (now)
		err = auditRepo.RevokeUserSession(ctx, targetUser, ownerA, "Suspected credential compromise")
		require.NoError(t, err)

		// T1 token is now invalid (revoked)
		validAfterRevocation, err := userRepo.IsSessionValid(ctx, targetUser, t1)
		require.NoError(t, err)
		assert.False(t, validAfterRevocation, "token issued before revocation must be rejected")

		// New token issued at T3 (after revocation)
		t3 := time.Now().Add(5 * time.Minute)
		validNewToken, err := userRepo.IsSessionValid(ctx, targetUser, t3)
		require.NoError(t, err)
		assert.True(t, validNewToken, "token issued after revocation must be accepted")
	})

	// =========================================================================
	// Health and Readiness Check
	// =========================================================================
	t.Run("CheckDatabaseHealth returns valid metrics and latency", func(t *testing.T) {
		health, err := auditRepo.CheckDatabaseHealth(ctx)
		require.NoError(t, err)
		assert.Equal(t, "connected", health.Status)
		assert.Greater(t, health.LatencyMs, float64(0))
		assert.GreaterOrEqual(t, health.TotalConns, int32(1))
	})
}
