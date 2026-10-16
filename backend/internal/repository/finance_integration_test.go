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
	"github.com/stretchr/testify/require"
)

func TestPropertyFinanceReconciliationAndLifecycle(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for finance integration tests")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	require.NoError(t, err)
	defer pool.Close()

	financeRepo := repository.NewFinanceRepository(pool)

	ownerID := uuid.New()
	tenantID := uuid.New()
	propertyID := uuid.New()
	roomID := uuid.New()
	contractID := uuid.New()

	// 1. Seed user, property, room, contract
	mustPoolExec(t, pool, `
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, phone)
		VALUES ($1, 'Finance Owner', $2, 'hash', 'owner', TRUE, TRUE, '628111111111')
	`, ownerID, "finance-owner-"+ownerID.String()+"@example.test")

	mustPoolExec(t, pool, `
		INSERT INTO users (id, name, email, password_hash, role, is_verified, is_active, phone)
		VALUES ($1, 'Finance Tenant', $2, 'hash', 'tenant', TRUE, TRUE, '628222222222')
	`, tenantID, "finance-tenant-"+tenantID.String()+"@example.test")

	mustPoolExec(t, pool, `
		INSERT INTO properties (id, name, address, timezone, currency, status, created_by)
		VALUES ($1, 'Kos Epic 12 Finance', 'Jl. Keuangan No. 1', 'Asia/Jakarta', 'IDR', 'active', $2)
	`, propertyID, ownerID)

	mustPoolExec(t, pool, `
		INSERT INTO property_memberships (property_id, user_id, role, permissions, status, created_by)
		VALUES ($1, $2, 'property_owner', '[]', 'active', $2)
	`, propertyID, ownerID)

	mustPoolExec(t, pool, `
		INSERT INTO rooms (id, property_id, room_number, price_per_month, status)
		VALUES ($1, $2, 'F-101', 2000000, 'occupied')
	`, roomID, propertyID)

	startDate := time.Date(2026, 10, 1, 0, 0, 0, 0, time.Local)
	endDate := time.Date(2027, 9, 30, 0, 0, 0, 0, time.Local)
	depositAmount := 1000000.0 // Rp 1.000.000 deposit

	mustPoolExec(t, pool, `
		INSERT INTO contracts (id, property_id, user_id, room_id, start_date, end_date, monthly_rent, deposit, status)
		VALUES ($1, $2, $3, $4, $5, $6, 2000000, $7, 'active')
	`, contractID, propertyID, tenantID, roomID, startDate, endDate, depositAmount)

	periodStart := "2026-10-01"
	periodEnd := "2026-10-31"

	// =========================================================================
	// AC 1, AC 2, AC 3: Financial Reconciliation, Exclusions, & Liabilities
	// =========================================================================
	t.Run("AC 1, AC 2, AC 3: Reconciliation, pending payment excluded, deposit liability isolated", func(t *testing.T) {
		// 1. Create a VERIFIED payment of 2,000,000
		paidPaymentID := uuid.New()
		mustPoolExec(t, pool, `
			INSERT INTO payments (id, property_id, contract_id, tenant_id, period_month, period_year, amount_rent, total_paid, amount_minor, status, payment_method, paid_at, created_at, due_date)
			VALUES ($1, $2, $3, $4, 10, 2026, 2000000, 2000000, 2000000, 'verified', 'bank_transfer', '2026-10-05 10:00:00+07', '2026-10-05 09:00:00+07', '2026-10-10')
		`, paidPaymentID, propertyID, contractID, tenantID)

		// 2. Create a PENDING payment of 1,500,000 (MUST NOT BE COUNTED AS CASH RECEIVED)
		pendingPaymentID := uuid.New()
		mustPoolExec(t, pool, `
			INSERT INTO payments (id, property_id, contract_id, tenant_id, period_month, period_year, amount_rent, total_paid, amount_minor, status, payment_method, created_at, due_date)
			VALUES ($1, $2, $3, $4, 11, 2026, 1500000, 0, 1500000, 'pending', 'manual_transfer', '2026-10-06 14:00:00+07', '2026-10-10')
		`, pendingPaymentID, propertyID, contractID, tenantID)

		// 3. Create an invoice of 2,000,000
		invoiceID := uuid.New()
		mustPoolExec(t, pool, `
			INSERT INTO invoices (id, property_id, contract_id, tenant_id, invoice_number, billing_period, due_at, total_minor, status, currency, idempotency_key)
			VALUES ($1, $2, $3, $4, 'INV-202610-001', '2026-10-01', '2026-10-10 23:59:59+07', 2000000, 'paid', 'IDR', $5)
		`, invoiceID, propertyID, contractID, tenantID, uuid.New().String())

		// 4. Create an outstanding unpaid invoice of 500,000
		unpaidInvoiceID := uuid.New()
		mustPoolExec(t, pool, `
			INSERT INTO invoices (id, property_id, contract_id, tenant_id, invoice_number, billing_period, invoice_type, due_at, total_minor, status, currency, idempotency_key)
			VALUES ($1, $2, $3, $4, 'INV-202610-002', '2026-10-01', 'adjustment', '2026-10-05 23:59:59+07', 500000, 'issued', 'IDR', $5)
		`, unpaidInvoiceID, propertyID, contractID, tenantID, uuid.New().String())

		// 5. Create an approved operational expense of 300,000
		exp, err := financeRepo.CreateExpense(ctx, propertyID, ownerID, model.CreateExpenseRequest{
			Category:      "utilities",
			VendorName:    "PLN Distribusi",
			Title:         "Tagihan Listrik Induk Oktober",
			Description:   "Listrik area umum kos",
			AmountMinor:   300000,
			ExpenseDate:   "2026-10-12",
			PaymentMethod: "bank_transfer",
			Status:        "approved",
		})
		require.NoError(t, err)
		require.Equal(t, int64(300000), exp.AmountMinor)
		require.Equal(t, "approved", exp.Status)

		// 6. Query Financial Dashboard
		dash, err := financeRepo.GetFinancialDashboard(ctx, propertyID, periodStart, periodEnd)
		require.NoError(t, err)

		// Check AC 2: Cash received MUST be 2,000,000 (pending 1,500,000 strictly excluded)
		require.Equal(t, int64(2000000), dash.CashReceivedMinor, "AC 2: pending payment must NOT be counted as cash received")
		require.Equal(t, int64(1500000), dash.PendingPaymentsMinor, "Pending payment should be tracked separately")

		// Check AC 3: Deposit liability must be Rp 1.000.000 and NOT counted in revenue!
		require.Equal(t, int64(1000000), dash.DepositLiabilityMinor, "AC 3: deposit is tracked as liability")
		require.Equal(t, int64(2500000), dash.BilledRevenueMinor, "Billed revenue reflects invoiced operating charges")

		// Check Operating Expense and NOI
		require.Equal(t, int64(300000), dash.OperatingExpensesMinor)
		require.Equal(t, int64(1700000), dash.NetOperatingIncomeMinor, "Cash NOI = 2,000,000 - 300,000 = 1,700,000")

		// Check Receivables Aging
		require.Equal(t, int64(500000), dash.TotalReceivableMinor)
		require.Equal(t, int64(500000), dash.ReceivablesAging.TotalOutstandingMinor)
		require.Len(t, dash.ReceivablesAging.Invoices, 1)
	})

	// =========================================================================
	// AC 4: Period Close, Lock Guard, and Post-Closure Adjustment Approval
	// =========================================================================
	t.Run("AC 4: Period closure locks regular mutations, adjustments require approval and audit trail", func(t *testing.T) {
		periodKey := "2026-10"

		// 1. Close period
		closure, err := financeRepo.ClosePeriod(ctx, propertyID, ownerID, model.ClosePeriodRequest{
			PeriodKey: periodKey,
			Notes:     "Tutup buku Oktober 2026 audit final",
		})
		require.NoError(t, err)
		require.Equal(t, "closed", closure.Status)
		require.Equal(t, periodKey, closure.PeriodKey)

		// 2. Try creating a regular expense backdated to the closed period -> MUST FAIL!
		_, err = financeRepo.CreateExpense(ctx, propertyID, ownerID, model.CreateExpenseRequest{
			Category:    "cleaning",
			Title:       "Beli Sabun Cuci",
			AmountMinor: 50000,
			ExpenseDate: "2026-10-15",
			Status:      "approved",
		})
		require.ErrorIs(t, err, repository.ErrPeriodClosed, "regular expense creation in closed period must be blocked")

		// 3. Post-closure adjustment workflow (AC 4)
		adj, err := financeRepo.CreateAdjustment(ctx, propertyID, ownerID, closure.ID, model.CreatePeriodAdjustmentRequest{
			AdjustmentType: "expense_adjustment",
			AmountMinor:    75000,
			Reason:         "Kwitansi perbaikan kran terlewat catat saat tutup buku",
		})
		require.NoError(t, err)
		require.Equal(t, "pending", adj.Status)
		require.Equal(t, int64(75000), adj.AmountMinor)
		require.NotEmpty(t, adj.AdjustmentNumber)

		// Check adjustment audit trail event
		require.Len(t, adj.Events, 1)
		require.Equal(t, "requested", adj.Events[0].EventType)

		// 4. Approve adjustment
		approvedAdj, err := financeRepo.ApproveAdjustment(ctx, propertyID, adj.ID, ownerID, model.ApproveAdjustmentRequest{
			Approved: true,
			Notes:    "Disetujui oleh Owner setelah verifikasi fisik bukti transfer",
		})
		require.NoError(t, err)
		require.Equal(t, "approved", approvedAdj.Status)
		require.NotNil(t, approvedAdj.ApprovedAt)
		require.Equal(t, &ownerID, approvedAdj.ApprovedBy)
		require.Len(t, approvedAdj.Events, 2)
		require.Equal(t, "approved", approvedAdj.Events[1].EventType)

		// 5. Verify database trigger prevents tampering with finalized adjustment!
		_, err = pool.Exec(ctx, `UPDATE finance_period_adjustments SET status = 'pending' WHERE id = $1`, adj.ID)
		require.Error(t, err, "database trigger must prevent tampering with finalized adjustment")
	})

	// =========================================================================
	// AC 5: Pagination & Background Export Jobs
	// =========================================================================
	t.Run("AC 5: Expense pagination and CSV report export job", func(t *testing.T) {
		// Pagination test
		expenses, total, err := financeRepo.ListExpenses(ctx, propertyID, model.ExpenseFilter{
			Page:     1,
			PageSize: 10,
		})
		require.NoError(t, err)
		require.GreaterOrEqual(t, total, 1)
		require.NotEmpty(t, expenses)

		// Create CSV export job
		job, err := financeRepo.CreateExportJob(ctx, propertyID, ownerID, model.CreateExportJobRequest{
			ReportType:   "cash_flow",
			PeriodStart:  "2026-10-01",
			PeriodEnd:    "2026-10-31",
			ExportFormat: "csv",
		})
		require.NoError(t, err)
		require.Equal(t, "completed", job.Status)
		require.Equal(t, "cash_flow", job.ReportType)
		require.NotEmpty(t, job.FileContent)
		require.NotEmpty(t, job.ChecksumSHA256)
		require.Contains(t, job.FileContent, "Tanggal,Arus,Tipe,Referensi,Deskripsi,Jumlah (IDR),Status")
	})
}
