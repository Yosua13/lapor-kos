package repository

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPeriodClosed               = errors.New("cannot create or modify expense in a closed financial period without an adjustment")
	ErrPeriodNotFound             = errors.New("finance period closure not found")
	ErrPeriodAlreadyClosed         = errors.New("finance period is already closed for this month")
	ErrExpenseNotFound            = errors.New("expense item not found")
	ErrAdjustmentNotFound         = errors.New("finance period adjustment not found")
	ErrAdjustmentAlreadyProcessed = errors.New("financial adjustment has already been finalized")
	ErrInvalidPeriodKey           = errors.New("invalid period key format, expected YYYY-MM")
)

type FinanceRepository struct {
	db *pgxpool.Pool
}

func NewFinanceRepository(db *pgxpool.Pool) *FinanceRepository {
	return &FinanceRepository{db: db}
}

// ============================================================================
// AC 1, AC 2, AC 3: Financial Dashboard Reconciliation
// ============================================================================

func (r *FinanceRepository) GetFinancialDashboard(ctx context.Context, propertyID uuid.UUID, periodStart, periodEnd string) (*model.FinancialDashboardSummary, error) {
	if periodStart == "" {
		now := time.Now()
		periodStart = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local).Format("2006-01-02")
	}
	if periodEnd == "" {
		now := time.Now()
		firstOfNext := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, time.Local)
		periodEnd = firstOfNext.AddDate(0, 0, -1).Format("2006-01-02")
	}

	summary := &model.FinancialDashboardSummary{
		PropertyID:  propertyID,
		Currency:    "IDR",
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}

	// 1. Property Name & Currency
	err := r.db.QueryRow(ctx, `
		SELECT name, currency FROM properties WHERE id = $1
	`, propertyID).Scan(&summary.PropertyName, &summary.Currency)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("property not found: %w", err)
		}
		return nil, fmt.Errorf("query property: %w", err)
	}

	// 2. Check if period is closed
	periodKey := ""
	if len(periodStart) >= 7 {
		periodKey = periodStart[:7]
	}
	closure, _ := r.GetPeriodClosure(ctx, propertyID, periodKey)
	if closure != nil && closure.Status != "reopened" {
		summary.IsPeriodClosed = true
		summary.PeriodClosure = closure
	}

	// 3. AC 2: Cash Received (Verified/Completed ONLY)
	// Pending, rejected, refunded, void payments are STRICTLY EXCLUDED!
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM payments
		WHERE property_id = $1
		  AND status IN ('verified', 'completed')
		  AND (
		    (paid_at IS NOT NULL AND paid_at >= $2::date AND paid_at < ($3::date + INTERVAL '1 day'))
		    OR
		    (paid_at IS NULL AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day'))
		  )
	`, propertyID, periodStart, periodEnd).Scan(&summary.CashReceivedMinor)
	if err != nil {
		return nil, fmt.Errorf("query cash received: %w", err)
	}

	// 4. Pending Payments (highlighted separately as pending cash, not received)
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM payments
		WHERE property_id = $1
		  AND status = 'pending'
		  AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day')
	`, propertyID, periodStart, periodEnd).Scan(&summary.PendingPaymentsMinor)
	if err != nil {
		return nil, fmt.Errorf("query pending payments: %w", err)
	}

	// 5. AC 3: Deposit Liability (Held deposits from active/scheduled contracts)
	// STRICT REQUIREMENT: Deposit is NOT counted as revenue!
	var rawDeposit float64
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(deposit), 0)
		FROM contracts
		WHERE property_id = $1
		  AND status IN ('active', 'scheduled', 'signed')
	`, propertyID).Scan(&rawDeposit)
	if err != nil {
		return nil, fmt.Errorf("query deposit liability: %w", err)
	}
	summary.DepositLiabilityMinor = int64(math.Round(rawDeposit))

	// 6. Billed Operational Revenue (Invoiced rent and utilities)
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_minor), 0)
		FROM invoices
		WHERE property_id = $1
		  AND status NOT IN ('draft', 'void', 'cancelled')
		  AND due_at >= $2::date AND due_at < ($3::date + INTERVAL '1 day')
	`, propertyID, periodStart, periodEnd).Scan(&summary.BilledRevenueMinor)
	if err != nil {
		return nil, fmt.Errorf("query billed revenue: %w", err)
	}

	// 7. Operating Expenses (Approved / Paid expenses in the period)
	err = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM expenses
		WHERE property_id = $1
		  AND status IN ('approved', 'paid')
		  AND expense_date >= $2::date AND expense_date <= $3::date
	`, propertyID, periodStart, periodEnd).Scan(&summary.OperatingExpensesMinor)
	if err != nil {
		return nil, fmt.Errorf("query operating expenses: %w", err)
	}

	// 8. Net Operating Incomes
	summary.NetOperatingIncomeMinor = summary.CashReceivedMinor - summary.OperatingExpensesMinor
	summary.AccrualNetIncomeMinor = summary.BilledRevenueMinor - summary.OperatingExpensesMinor

	// 9. Receivables Aging
	aging, err := r.GetReceivablesAging(ctx, propertyID)
	if err != nil {
		return nil, fmt.Errorf("query receivables aging: %w", err)
	}
	summary.ReceivablesAging = *aging
	summary.TotalReceivableMinor = aging.TotalOutstandingMinor

	// 10. Expenses by Category
	catSummaries, err := r.GetExpensesByCategory(ctx, propertyID, periodStart, periodEnd, summary.OperatingExpensesMinor)
	if err != nil {
		return nil, fmt.Errorf("query expenses by category: %w", err)
	}
	summary.ExpensesByCategory = catSummaries

	// 11. Occupancy Financial Stats
	occStats, err := r.GetOccupancyStats(ctx, propertyID)
	if err != nil {
		return nil, fmt.Errorf("query occupancy stats: %w", err)
	}
	summary.OccupancyStats = *occStats

	return summary, nil
}

func (r *FinanceRepository) GetReceivablesAging(ctx context.Context, propertyID uuid.UUID) (*model.ReceivablesAgingSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT i.id, i.invoice_number, i.due_at, i.total_minor,
		       GREATEST(0, i.total_minor -
		        COALESCE((SELECT SUM(a.amount_minor) FROM invoice_allocations a WHERE a.invoice_id=i.id AND a.status='valid'),0) -
		        COALESCE((SELECT SUM(cr.amount_minor) FROM invoice_credit_applications cr WHERE cr.invoice_id=i.id AND cr.status='valid'),0)
		       ) as outstanding_minor,
		       COALESCE(u.name, 'Penghuni') as tenant_name,
		       COALESCE(rm.room_number, '-') as room_number,
		       GREATEST(0, EXTRACT(DAY FROM (NOW() - i.due_at)))::int as days_past_due
		FROM invoices i
		LEFT JOIN contracts c ON i.contract_id = c.id
		LEFT JOIN users u ON i.tenant_id = u.id
		LEFT JOIN rooms rm ON c.room_id = rm.id
		WHERE i.property_id = $1
		  AND i.status IN ('issued', 'partially_paid', 'overdue')
		  AND (i.total_minor -
		        COALESCE((SELECT SUM(a.amount_minor) FROM invoice_allocations a WHERE a.invoice_id=i.id AND a.status='valid'),0) -
		        COALESCE((SELECT SUM(cr.amount_minor) FROM invoice_credit_applications cr WHERE cr.invoice_id=i.id AND cr.status='valid'),0)
		      ) > 0
		ORDER BY i.due_at ASC
	`, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	aging := &model.ReceivablesAgingSummary{
		Invoices: make([]model.AgingInvoiceItem, 0),
	}

	for rows.Next() {
		var item model.AgingInvoiceItem
		var daysPastDue int
		err := rows.Scan(
			&item.InvoiceID,
			&item.InvoiceNumber,
			&item.DueAt,
			&item.TotalMinor,
			&item.OutstandingMinor,
			&item.TenantName,
			&item.RoomNumber,
			&daysPastDue,
		)
		if err != nil {
			return nil, err
		}
		item.DaysPastDue = daysPastDue

		if daysPastDue <= 30 {
			item.AgingBucket = "current"
			aging.CurrentMinor += item.OutstandingMinor
		} else if daysPastDue <= 60 {
			item.AgingBucket = "31_60"
			aging.Due31To60Minor += item.OutstandingMinor
		} else if daysPastDue <= 90 {
			item.AgingBucket = "61_90"
			aging.Due61To90Minor += item.OutstandingMinor
		} else {
			item.AgingBucket = "90_plus"
			aging.Overdue90PlusMinor += item.OutstandingMinor
		}

		aging.TotalOutstandingMinor += item.OutstandingMinor
		aging.Invoices = append(aging.Invoices, item)
	}

	return aging, rows.Err()
}

func (r *FinanceRepository) GetExpensesByCategory(ctx context.Context, propertyID uuid.UUID, periodStart, periodEnd string, totalOperatingExpenses int64) ([]model.CategoryExpenseSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT category, COALESCE(SUM(amount_minor), 0), COUNT(*)
		FROM expenses
		WHERE property_id = $1
		  AND status IN ('approved', 'paid')
		  AND expense_date >= $2::date AND expense_date <= $3::date
		GROUP BY category
		ORDER BY SUM(amount_minor) DESC
	`, propertyID, periodStart, periodEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := make([]model.CategoryExpenseSummary, 0)
	for rows.Next() {
		var c model.CategoryExpenseSummary
		err := rows.Scan(&c.Category, &c.TotalMinor, &c.Count)
		if err != nil {
			return nil, err
		}
		c.CategoryLabel = formatCategoryLabel(c.Category)
		if totalOperatingExpenses > 0 {
			c.Percentage = math.Round((float64(c.TotalMinor)/float64(totalOperatingExpenses))*1000) / 10
		}
		categories = append(categories, c)
	}
	return categories, rows.Err()
}

func (r *FinanceRepository) GetOccupancyStats(ctx context.Context, propertyID uuid.UUID) (*model.OccupancyFinancialStats, error) {
	stats := &model.OccupancyFinancialStats{}
	err := r.db.QueryRow(ctx, `
		SELECT 
		  COUNT(*)::int as total_rooms,
		  COUNT(*) FILTER (WHERE status = 'occupied')::int as occupied_rooms,
		  COUNT(*) FILTER (WHERE status = 'available')::int as available_rooms,
		  COALESCE(SUM(price_per_month), 0)::bigint as potential_rev,
		  COALESCE(SUM(price_per_month) FILTER (WHERE status = 'occupied'), 0)::bigint as actual_rev
		FROM rooms
		WHERE property_id = $1
	`, propertyID).Scan(
		&stats.TotalRooms,
		&stats.OccupiedRooms,
		&stats.AvailableRooms,
		&stats.PotentialMonthlyRevenueMinor,
		&stats.ActualMonthlyRevenueMinor,
	)
	if err != nil {
		return nil, err
	}
	if stats.TotalRooms > 0 {
		stats.OccupancyRate = math.Round((float64(stats.OccupiedRooms)/float64(stats.TotalRooms))*1000) / 10
	}
	return stats, nil
}

// ============================================================================
// Expenses Management
// ============================================================================

func (r *FinanceRepository) ListExpenses(ctx context.Context, propertyID uuid.UUID, filter model.ExpenseFilter) ([]model.Expense, int, error) {
	if filter.Page <= 0 {
		filter.Page = 1
	}
	if filter.PageSize <= 0 || filter.PageSize > 100 {
		filter.PageSize = 20
	}
	offset := (filter.Page - 1) * filter.PageSize

	where := []string{"e.property_id = $1"}
	args := []any{propertyID}
	argIdx := 2

	if filter.Category != "" && filter.Category != "all" {
		where = append(where, fmt.Sprintf("e.category = $%d", argIdx))
		args = append(args, filter.Category)
		argIdx++
	}
	if filter.Status != "" && filter.Status != "all" {
		where = append(where, fmt.Sprintf("e.status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.VendorID != "" {
		if vID, err := uuid.Parse(filter.VendorID); err == nil {
			where = append(where, fmt.Sprintf("e.vendor_id = $%d", argIdx))
			args = append(args, vID)
			argIdx++
		}
	}
	if filter.StartDate != "" {
		where = append(where, fmt.Sprintf("e.expense_date >= $%d::date", argIdx))
		args = append(args, filter.StartDate)
		argIdx++
	}
	if filter.EndDate != "" {
		where = append(where, fmt.Sprintf("e.expense_date <= $%d::date", argIdx))
		args = append(args, filter.EndDate)
		argIdx++
	}
	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(e.title ILIKE $%d OR e.description ILIKE $%d OR e.expense_number ILIKE $%d OR e.vendor_name ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM expenses e WHERE %s", whereClause)
	err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count expenses: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT e.id, e.property_id, e.expense_number, e.category, e.vendor_id, e.vendor_name,
		       e.title, e.description, e.amount_minor, e.currency, e.expense_date::text, e.status,
		       e.payment_method, e.proof_file_id, e.is_recurring, e.recurring_interval,
		       e.created_by, e.approved_by, e.approved_at, e.paid_at, e.rejection_reason,
		       e.period_close_id, e.created_at, e.updated_at,
		       COALESCE(u1.name, '') as created_by_name,
		       COALESCE(u2.name, '') as approved_by_name
		FROM expenses e
		LEFT JOIN users u1 ON e.created_by = u1.id
		LEFT JOIN users u2 ON e.approved_by = u2.id
		WHERE %s
		ORDER BY e.expense_date DESC, e.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, filter.PageSize, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("list expenses: %w", err)
	}
	defer rows.Close()

	expenses := make([]model.Expense, 0)
	for rows.Next() {
		var e model.Expense
		err := rows.Scan(
			&e.ID, &e.PropertyID, &e.ExpenseNumber, &e.Category, &e.VendorID, &e.VendorName,
			&e.Title, &e.Description, &e.AmountMinor, &e.Currency, &e.ExpenseDate, &e.Status,
			&e.PaymentMethod, &e.ProofFileID, &e.IsRecurring, &e.RecurringInterval,
			&e.CreatedBy, &e.ApprovedBy, &e.ApprovedAt, &e.PaidAt, &e.RejectionReason,
			&e.PeriodCloseID, &e.CreatedAt, &e.UpdatedAt,
			&e.CreatedByName, &e.ApprovedByName,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("scan expense: %w", err)
		}
		expenses = append(expenses, e)
	}

	return expenses, total, rows.Err()
}

func (r *FinanceRepository) GetExpenseByID(ctx context.Context, propertyID, expenseID uuid.UUID) (*model.Expense, error) {
	row := r.db.QueryRow(ctx, `
		SELECT e.id, e.property_id, e.expense_number, e.category, e.vendor_id, e.vendor_name,
		       e.title, e.description, e.amount_minor, e.currency, e.expense_date::text, e.status,
		       e.payment_method, e.proof_file_id, e.is_recurring, e.recurring_interval,
		       e.created_by, e.approved_by, e.approved_at, e.paid_at, e.rejection_reason,
		       e.period_close_id, e.created_at, e.updated_at,
		       COALESCE(u1.name, '') as created_by_name,
		       COALESCE(u2.name, '') as approved_by_name
		FROM expenses e
		LEFT JOIN users u1 ON e.created_by = u1.id
		LEFT JOIN users u2 ON e.approved_by = u2.id
		WHERE e.property_id = $1 AND e.id = $2
	`, propertyID, expenseID)

	var e model.Expense
	err := row.Scan(
		&e.ID, &e.PropertyID, &e.ExpenseNumber, &e.Category, &e.VendorID, &e.VendorName,
		&e.Title, &e.Description, &e.AmountMinor, &e.Currency, &e.ExpenseDate, &e.Status,
		&e.PaymentMethod, &e.ProofFileID, &e.IsRecurring, &e.RecurringInterval,
		&e.CreatedBy, &e.ApprovedBy, &e.ApprovedAt, &e.PaidAt, &e.RejectionReason,
		&e.PeriodCloseID, &e.CreatedAt, &e.UpdatedAt,
		&e.CreatedByName, &e.ApprovedByName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrExpenseNotFound
	}
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *FinanceRepository) CreateExpense(ctx context.Context, propertyID, creatorID uuid.UUID, req model.CreateExpenseRequest) (*model.Expense, error) {
	// AC 4: Check if expense date falls in a closed period
	periodKey := ""
	if len(req.ExpenseDate) >= 7 {
		periodKey = req.ExpenseDate[:7]
	}
	closure, _ := r.GetPeriodClosure(ctx, propertyID, periodKey)
	if closure != nil && closure.Status != "reopened" {
		return nil, ErrPeriodClosed
	}

	var vendorID *uuid.UUID
	if req.VendorID != "" {
		if parsed, err := uuid.Parse(req.VendorID); err == nil {
			vendorID = &parsed
		}
	}

	var proofFileID *uuid.UUID
	if req.ProofFileID != "" {
		if parsed, err := uuid.Parse(req.ProofFileID); err == nil {
			proofFileID = &parsed
		}
	}

	status := strings.TrimSpace(req.Status)
	if status == "" {
		status = "approved" // Default to approved unless explicitly draft
	}

	paymentMethod := strings.TrimSpace(req.PaymentMethod)
	if paymentMethod == "" {
		paymentMethod = "bank_transfer"
	}

	var recurringInterval *string
	if req.IsRecurring && req.RecurringInterval != "" {
		recurringInterval = &req.RecurringInterval
	}

	expenseNumber := fmt.Sprintf("EXP-%s-%04d", time.Now().Format("200601"), time.Now().UnixNano()%10000)

	var paidAt *time.Time
	if status == "paid" {
		now := time.Now()
		paidAt = &now
	}

	var approvedBy *uuid.UUID
	var approvedAt *time.Time
	if status == "approved" || status == "paid" {
		approvedBy = &creatorID
		now := time.Now()
		approvedAt = &now
	}

	id := uuid.New()
	_, err := r.db.Exec(ctx, `
		INSERT INTO expenses (
			id, property_id, expense_number, category, vendor_id, vendor_name,
			title, description, amount_minor, currency, expense_date, status,
			payment_method, proof_file_id, is_recurring, recurring_interval,
			created_by, approved_by, approved_at, paid_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, 'IDR', $10::date, $11,
			$12, $13, $14, $15,
			$16, $17, $18, $19
		)
	`, id, propertyID, expenseNumber, req.Category, vendorID, req.VendorName,
		req.Title, req.Description, req.AmountMinor, req.ExpenseDate, status,
		paymentMethod, proofFileID, req.IsRecurring, recurringInterval,
		creatorID, approvedBy, approvedAt, paidAt)

	if err != nil {
		return nil, fmt.Errorf("insert expense: %w", err)
	}

	r.logFinancialAudit(ctx, propertyID, &creatorID, "expense_create", "expense", id, req.AmountMinor, req.Description, nil, map[string]any{"status": status, "title": req.Title})

	return r.GetExpenseByID(ctx, propertyID, id)
}

func (r *FinanceRepository) UpdateExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, req model.UpdateExpenseRequest) (*model.Expense, error) {
	current, err := r.GetExpenseByID(ctx, propertyID, expenseID)
	if err != nil {
		return nil, err
	}

	// Check if current or target date is in closed period
	periodKey := ""
	if len(current.ExpenseDate) >= 7 {
		periodKey = current.ExpenseDate[:7]
	}
	closure, _ := r.GetPeriodClosure(ctx, propertyID, periodKey)
	if closure != nil && closure.Status != "reopened" {
		return nil, ErrPeriodClosed
	}

	category := current.Category
	if req.Category != "" {
		category = req.Category
	}
	title := current.Title
	if req.Title != "" {
		title = req.Title
	}
	description := current.Description
	if req.Description != "" {
		description = req.Description
	}
	amountMinor := current.AmountMinor
	if req.AmountMinor > 0 {
		amountMinor = req.AmountMinor
	}
	expenseDate := current.ExpenseDate
	if req.ExpenseDate != "" {
		expenseDate = req.ExpenseDate
	}
	vendorName := current.VendorName
	if req.VendorName != "" {
		vendorName = req.VendorName
	}
	status := current.Status
	if req.Status != "" {
		status = req.Status
	}
	paymentMethod := current.PaymentMethod
	if req.PaymentMethod != "" {
		paymentMethod = req.PaymentMethod
	}

	_, err = r.db.Exec(ctx, `
		UPDATE expenses
		SET category = $1, title = $2, description = $3, amount_minor = $4,
		    expense_date = $5::date, vendor_name = $6, status = $7, payment_method = $8,
		    updated_at = NOW()
		WHERE property_id = $9 AND id = $10
	`, category, title, description, amountMinor, expenseDate, vendorName, status, paymentMethod, propertyID, expenseID)

	if err != nil {
		return nil, fmt.Errorf("update expense: %w", err)
	}

	return r.GetExpenseByID(ctx, propertyID, expenseID)
}

func (r *FinanceRepository) ApproveExpense(ctx context.Context, propertyID, expenseID, approverID uuid.UUID) (*model.Expense, error) {
	now := time.Now()
	res, err := r.db.Exec(ctx, `
		UPDATE expenses
		SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = NOW()
		WHERE property_id = $3 AND id = $4 AND status IN ('draft', 'pending_approval')
	`, approverID, now, propertyID, expenseID)
	if err != nil {
		return nil, fmt.Errorf("approve expense: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, fmt.Errorf("expense not in approvable state")
	}

	resExp, _ := r.GetExpenseByID(ctx, propertyID, expenseID)
	var amountMinor int64
	if resExp != nil {
		amountMinor = resExp.AmountMinor
	}
	r.logFinancialAudit(ctx, propertyID, &approverID, "expense_approve", "expense", expenseID, amountMinor, "Approved expense", map[string]any{"status": "pending_approval"}, map[string]any{"status": "approved"})

	return r.GetExpenseByID(ctx, propertyID, expenseID)
}

func (r *FinanceRepository) PayExpense(ctx context.Context, propertyID, expenseID, actorID uuid.UUID, paymentMethod string) (*model.Expense, error) {
	if paymentMethod == "" {
		paymentMethod = "bank_transfer"
	}
	now := time.Now()
	res, err := r.db.Exec(ctx, `
		UPDATE expenses
		SET status = 'paid', paid_at = $1, payment_method = $2, updated_at = NOW()
		WHERE property_id = $3 AND id = $4 AND status IN ('approved', 'draft', 'pending_approval')
	`, now, paymentMethod, propertyID, expenseID)
	if err != nil {
		return nil, fmt.Errorf("pay expense: %w", err)
	}
	if res.RowsAffected() == 0 {
		return nil, fmt.Errorf("expense cannot be marked as paid")
	}

	resExp, _ := r.GetExpenseByID(ctx, propertyID, expenseID)
	var amountMinor int64
	if resExp != nil {
		amountMinor = resExp.AmountMinor
	}
	r.logFinancialAudit(ctx, propertyID, &actorID, "expense_pay", "expense", expenseID, amountMinor, "Expense marked as paid", map[string]any{"status": "approved"}, map[string]any{"status": "paid", "payment_method": paymentMethod})

	return r.GetExpenseByID(ctx, propertyID, expenseID)
}

func (r *FinanceRepository) DeleteExpense(ctx context.Context, propertyID, expenseID uuid.UUID) error {
	exp, _ := r.GetExpenseByID(ctx, propertyID, expenseID)
	res, err := r.db.Exec(ctx, `
		DELETE FROM expenses
		WHERE property_id = $1 AND id = $2 AND status IN ('draft', 'pending_approval', 'rejected')
	`, propertyID, expenseID)
	if err != nil {
		return fmt.Errorf("delete expense: %w", err)
	}
	if res.RowsAffected() == 0 {
		return errors.New("cannot delete approved or paid expenses; use period adjustment or reversal")
	}
	if exp != nil {
		r.logFinancialAudit(ctx, propertyID, nil, "expense_delete", "expense", expenseID, exp.AmountMinor, "Deleted expense", exp, nil)
	}
	return nil
}

// ============================================================================
// AC 4: Period Closures & Post-Closure Adjustments (Audit Trailed)
// ============================================================================

func (r *FinanceRepository) GetPeriodClosure(ctx context.Context, propertyID uuid.UUID, periodKey string) (*model.FinancePeriodClosure, error) {
	if len(periodKey) != 7 {
		return nil, ErrInvalidPeriodKey
	}
	row := r.db.QueryRow(ctx, `
		SELECT c.id, c.property_id, c.period_key, c.period_start::text, c.period_end::text,
		       c.status, c.closed_by, COALESCE(u.name, '') as closed_by_name, c.closed_at,
		       c.reopened_by, COALESCE(u2.name, '') as reopened_by_name, c.reopened_at, c.reopen_reason,
		       c.summary_snapshot, c.notes, c.created_at, c.updated_at
		FROM finance_period_closures c
		LEFT JOIN users u ON c.closed_by = u.id
		LEFT JOIN users u2 ON c.reopened_by = u2.id
		WHERE c.property_id = $1 AND c.period_key = $2
	`, propertyID, periodKey)

	var c model.FinancePeriodClosure
	err := row.Scan(
		&c.ID, &c.PropertyID, &c.PeriodKey, &c.PeriodStart, &c.PeriodEnd,
		&c.Status, &c.ClosedBy, &c.ClosedByName, &c.ClosedAt,
		&c.ReopenedBy, &c.ReopenedByName, &c.ReopenedAt, &c.ReopenReason,
		&c.SummarySnapshot, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPeriodNotFound
	}
	if err != nil {
		return nil, err
	}

	// Fetch adjustments for this period
	adjs, _ := r.ListAdjustments(ctx, propertyID, &c.ID)
	c.Adjustments = adjs

	return &c, nil
}

func (r *FinanceRepository) ListPeriodClosures(ctx context.Context, propertyID uuid.UUID) ([]model.FinancePeriodClosure, error) {
	rows, err := r.db.Query(ctx, `
		SELECT c.id, c.property_id, c.period_key, c.period_start::text, c.period_end::text,
		       c.status, c.closed_by, COALESCE(u.name, '') as closed_by_name, c.closed_at,
		       c.reopened_by, COALESCE(u2.name, '') as reopened_by_name, c.reopened_at, c.reopen_reason,
		       c.summary_snapshot, c.notes, c.created_at, c.updated_at
		FROM finance_period_closures c
		LEFT JOIN users u ON c.closed_by = u.id
		LEFT JOIN users u2 ON c.reopened_by = u2.id
		WHERE c.property_id = $1
		ORDER BY c.period_key DESC
	`, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	closures := make([]model.FinancePeriodClosure, 0)
	for rows.Next() {
		var c model.FinancePeriodClosure
		err := rows.Scan(
			&c.ID, &c.PropertyID, &c.PeriodKey, &c.PeriodStart, &c.PeriodEnd,
			&c.Status, &c.ClosedBy, &c.ClosedByName, &c.ClosedAt,
			&c.ReopenedBy, &c.ReopenedByName, &c.ReopenedAt, &c.ReopenReason,
			&c.SummarySnapshot, &c.Notes, &c.CreatedAt, &c.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		closures = append(closures, c)
	}
	return closures, rows.Err()
}

func (r *FinanceRepository) ClosePeriod(ctx context.Context, propertyID, closedByID uuid.UUID, req model.ClosePeriodRequest) (*model.FinancePeriodClosure, error) {
	if len(req.PeriodKey) != 7 {
		return nil, ErrInvalidPeriodKey
	}

	// Calculate period start and end from periodKey (YYYY-MM)
	t, err := time.Parse("2006-01", req.PeriodKey)
	if err != nil {
		return nil, ErrInvalidPeriodKey
	}
	periodStart := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.Local).Format("2006-01-02")
	firstOfNext := time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, time.Local)
	periodEnd := firstOfNext.AddDate(0, 0, -1).Format("2006-01-02")

	// Verify not already closed
	existing, _ := r.GetPeriodClosure(ctx, propertyID, req.PeriodKey)
	if existing != nil && existing.Status != "reopened" {
		return nil, ErrPeriodAlreadyClosed
	}

	// Generate snapshot of dashboard figures
	dash, err := r.GetFinancialDashboard(ctx, propertyID, periodStart, periodEnd)
	if err != nil {
		return nil, fmt.Errorf("calculate closure snapshot: %w", err)
	}

	snapshotBytes, err := json.Marshal(dash)
	if err != nil {
		return nil, fmt.Errorf("marshal snapshot: %w", err)
	}

	closureID := uuid.New()
	_, err = r.db.Exec(ctx, `
		INSERT INTO finance_period_closures (
			id, property_id, period_key, period_start, period_end, status,
			closed_by, closed_at, summary_snapshot, notes
		) VALUES (
			$1, $2, $3, $4::date, $5::date, 'closed',
			$6, NOW(), $7, $8
		)
		ON CONFLICT (property_id, period_key) DO UPDATE
		SET status = 'closed', closed_by = EXCLUDED.closed_by, closed_at = NOW(),
		    summary_snapshot = EXCLUDED.summary_snapshot, notes = EXCLUDED.notes,
		    reopened_by = NULL, reopened_at = NULL, reopen_reason = '', updated_at = NOW()
	`, closureID, propertyID, req.PeriodKey, periodStart, periodEnd, closedByID, snapshotBytes, req.Notes)

	if err != nil {
		return nil, fmt.Errorf("insert closure: %w", err)
	}

	// Link all existing expenses in this date range to this period_close_id
	_, _ = r.db.Exec(ctx, `
		UPDATE expenses
		SET period_close_id = $1
		WHERE property_id = $2
		  AND expense_date >= $3::date AND expense_date <= $4::date
	`, closureID, propertyID, periodStart, periodEnd)

	r.logFinancialAudit(ctx, propertyID, &closedByID, "period_close", "period_close", closureID, 0, req.Notes, nil, map[string]any{"period_key": req.PeriodKey, "status": "closed"})

	return r.GetPeriodClosure(ctx, propertyID, req.PeriodKey)
}

func (r *FinanceRepository) ReopenPeriod(ctx context.Context, propertyID, reopenedByID uuid.UUID, periodKey string, req model.ReopenPeriodRequest) (*model.FinancePeriodClosure, error) {
	closure, err := r.GetPeriodClosure(ctx, propertyID, periodKey)
	if err != nil {
		return nil, err
	}
	if closure.Status == "locked" {
		return nil, errors.New("period is locked and cannot be reopened")
	}

	now := time.Now()
	_, err = r.db.Exec(ctx, `
		UPDATE finance_period_closures
		SET status = 'reopened', reopened_by = $1, reopened_at = $2, reopen_reason = $3, updated_at = NOW()
		WHERE property_id = $4 AND period_key = $5
	`, reopenedByID, now, req.Reason, propertyID, periodKey)

	if err != nil {
		return nil, fmt.Errorf("reopen period: %w", err)
	}

	r.logFinancialAudit(ctx, propertyID, &reopenedByID, "period_reopen", "period_close", closure.ID, 0, req.Reason, map[string]any{"previous_status": closure.Status}, map[string]any{"status": "reopened"})

	return r.GetPeriodClosure(ctx, propertyID, periodKey)
}

func (r *FinanceRepository) CreateAdjustment(ctx context.Context, propertyID, requestedByID, periodCloseID uuid.UUID, req model.CreatePeriodAdjustmentRequest) (*model.FinancePeriodAdjustment, error) {
	adjNumber := fmt.Sprintf("ADJ-%s-%04d", time.Now().Format("200601"), time.Now().UnixNano()%10000)
	id := uuid.New()

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `
		INSERT INTO finance_period_adjustments (
			id, property_id, period_close_id, adjustment_number, adjustment_type,
			amount_minor, reason, status, requested_by
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, 'pending', $8
		)
	`, id, propertyID, periodCloseID, adjNumber, req.AdjustmentType, req.AmountMinor, req.Reason, requestedByID)
	if err != nil {
		return nil, fmt.Errorf("insert adjustment: %w", err)
	}

	// Record audit event (AC 4)
	eventID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO finance_period_adjustment_events (
			id, adjustment_id, property_id, actor_id, event_type, previous_status, new_status, notes
		) VALUES (
			$1, $2, $3, $4, 'requested', '', 'pending', $5
		)
	`, eventID, id, propertyID, requestedByID, req.Reason)
	if err != nil {
		return nil, fmt.Errorf("insert adjustment event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	r.logFinancialAudit(ctx, propertyID, &requestedByID, "adjustment_create", "adjustment", id, req.AmountMinor, req.Reason, nil, map[string]any{"status": "pending", "adjustment_number": adjNumber})

	return r.GetAdjustmentByID(ctx, propertyID, id)
}

func (r *FinanceRepository) ListAdjustments(ctx context.Context, propertyID uuid.UUID, periodCloseID *uuid.UUID) ([]model.FinancePeriodAdjustment, error) {
	where := []string{"a.property_id = $1"}
	args := []any{propertyID}

	if periodCloseID != nil {
		where = append(where, "a.period_close_id = $2")
		args = append(args, *periodCloseID)
	}

	query := fmt.Sprintf(`
		SELECT a.id, a.property_id, a.period_close_id, a.adjustment_number, a.adjustment_type,
		       a.amount_minor, a.reason, a.status, a.requested_by, COALESCE(u1.name, '') as requested_by_name,
		       a.approved_by, COALESCE(u2.name, '') as approved_by_name, a.approved_at,
		       a.rejection_reason, a.created_at, a.updated_at
		FROM finance_period_adjustments a
		LEFT JOIN users u1 ON a.requested_by = u1.id
		LEFT JOIN users u2 ON a.approved_by = u2.id
		WHERE %s
		ORDER BY a.created_at DESC
	`, strings.Join(where, " AND "))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	adjs := make([]model.FinancePeriodAdjustment, 0)
	for rows.Next() {
		var a model.FinancePeriodAdjustment
		err := rows.Scan(
			&a.ID, &a.PropertyID, &a.PeriodCloseID, &a.AdjustmentNumber, &a.AdjustmentType,
			&a.AmountMinor, &a.Reason, &a.Status, &a.RequestedBy, &a.RequestedByName,
			&a.ApprovedBy, &a.ApprovedByName, &a.ApprovedAt,
			&a.RejectionReason, &a.CreatedAt, &a.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		adjs = append(adjs, a)
	}
	return adjs, rows.Err()
}

func (r *FinanceRepository) GetAdjustmentByID(ctx context.Context, propertyID, adjustmentID uuid.UUID) (*model.FinancePeriodAdjustment, error) {
	row := r.db.QueryRow(ctx, `
		SELECT a.id, a.property_id, a.period_close_id, a.adjustment_number, a.adjustment_type,
		       a.amount_minor, a.reason, a.status, a.requested_by, COALESCE(u1.name, '') as requested_by_name,
		       a.approved_by, COALESCE(u2.name, '') as approved_by_name, a.approved_at,
		       a.rejection_reason, a.created_at, a.updated_at
		FROM finance_period_adjustments a
		LEFT JOIN users u1 ON a.requested_by = u1.id
		LEFT JOIN users u2 ON a.approved_by = u2.id
		WHERE a.property_id = $1 AND a.id = $2
	`, propertyID, adjustmentID)

	var a model.FinancePeriodAdjustment
	err := row.Scan(
		&a.ID, &a.PropertyID, &a.PeriodCloseID, &a.AdjustmentNumber, &a.AdjustmentType,
		&a.AmountMinor, &a.Reason, &a.Status, &a.RequestedBy, &a.RequestedByName,
		&a.ApprovedBy, &a.ApprovedByName, &a.ApprovedAt,
		&a.RejectionReason, &a.CreatedAt, &a.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAdjustmentNotFound
	}
	if err != nil {
		return nil, err
	}

	// Fetch events
	eRows, err := r.db.Query(ctx, `
		SELECT ev.id, ev.adjustment_id, ev.property_id, ev.actor_id, COALESCE(u.name, '') as actor_name,
		       ev.event_type, ev.previous_status, ev.new_status, ev.notes, ev.created_at
		FROM finance_period_adjustment_events ev
		LEFT JOIN users u ON ev.actor_id = u.id
		WHERE ev.adjustment_id = $1
		ORDER BY ev.created_at ASC
	`, adjustmentID)
	if err == nil {
		defer eRows.Close()
		events := make([]model.FinancePeriodAdjustmentEvent, 0)
		for eRows.Next() {
			var ev model.FinancePeriodAdjustmentEvent
			if err := eRows.Scan(&ev.ID, &ev.AdjustmentID, &ev.PropertyID, &ev.ActorID, &ev.ActorName, &ev.EventType, &ev.PreviousStatus, &ev.NewStatus, &ev.Notes, &ev.CreatedAt); err == nil {
				events = append(events, ev)
			}
		}
		a.Events = events
	}

	return &a, nil
}

func (r *FinanceRepository) ApproveAdjustment(ctx context.Context, propertyID, adjustmentID, approverID uuid.UUID, req model.ApproveAdjustmentRequest) (*model.FinancePeriodAdjustment, error) {
	current, err := r.GetAdjustmentByID(ctx, propertyID, adjustmentID)
	if err != nil {
		return nil, err
	}
	if current.Status != "pending" {
		return nil, ErrAdjustmentAlreadyProcessed
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	newStatus := "rejected"
	var approvedAt *time.Time
	if req.Approved {
		newStatus = "approved"
		now := time.Now()
		approvedAt = &now
	}

	_, err = tx.Exec(ctx, `
		UPDATE finance_period_adjustments
		SET status = $1, approved_by = $2, approved_at = $3, rejection_reason = $4, updated_at = NOW()
		WHERE property_id = $5 AND id = $6
	`, newStatus, approverID, approvedAt, req.RejectionReason, propertyID, adjustmentID)
	if err != nil {
		return nil, fmt.Errorf("update adjustment: %w", err)
	}

	// Record audit trail event (AC 4)
	eventID := uuid.New()
	notes := req.Notes
	if notes == "" {
		if req.Approved {
			notes = "Adjustment approved"
		} else {
			notes = fmt.Sprintf("Adjustment rejected: %s", req.RejectionReason)
		}
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO finance_period_adjustment_events (
			id, adjustment_id, property_id, actor_id, event_type, previous_status, new_status, notes
		) VALUES (
			$1, $2, $3, $4, $5, 'pending', $6, $7
		)
	`, eventID, adjustmentID, propertyID, approverID, newStatus, newStatus, notes)
	if err != nil {
		return nil, fmt.Errorf("insert adjustment event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	r.logFinancialAudit(ctx, propertyID, &approverID, "adjustment_"+newStatus, "adjustment", adjustmentID, current.AmountMinor, notes, map[string]any{"previous_status": current.Status}, map[string]any{"status": newStatus})

	return r.GetAdjustmentByID(ctx, propertyID, adjustmentID)
}

// ============================================================================
// AC 5: Large Report Export Jobs (CSV generation with Audit Trail)
// ============================================================================

func (r *FinanceRepository) CreateExportJob(ctx context.Context, propertyID, requestedByID uuid.UUID, req model.CreateExportJobRequest) (*model.FinanceExportJob, error) {
	jobID := uuid.New()
	exportFormat := strings.ToLower(strings.TrimSpace(req.ExportFormat))
	if exportFormat == "" {
		exportFormat = "csv"
	}

	fileName := fmt.Sprintf("laporan-%s-%s_%s.%s", req.ReportType, req.PeriodStart, req.PeriodEnd, exportFormat)

	csvContent, totalRows, err := r.generateCSVReport(ctx, propertyID, req.ReportType, req.PeriodStart, req.PeriodEnd)
	if err != nil {
		return nil, fmt.Errorf("generate report data: %w", err)
	}

	hasher := sha256.New()
	hasher.Write([]byte(csvContent))
	checksum := hex.EncodeToString(hasher.Sum(nil))

	metadataMap := map[string]any{
		"generated_by": requestedByID.String(),
		"generated_at": time.Now().Format(time.RFC3339),
		"report_type":  req.ReportType,
		"period_start": req.PeriodStart,
		"period_end":   req.PeriodEnd,
		"row_count":    totalRows,
		"checksum":     checksum,
	}
	metaBytes, _ := json.Marshal(metadataMap)

	now := time.Now()
	_, err = r.db.Exec(ctx, `
		INSERT INTO finance_export_jobs (
			id, property_id, requested_by, report_type, period_start, period_end,
			export_format, status, file_name, file_content, total_rows, checksum_sha256,
			metadata, created_at, completed_at
		) VALUES (
			$1, $2, $3, $4, $5::date, $6::date,
			$7, 'completed', $8, $9, $10, $11,
			$12, NOW(), $13
		)
	`, jobID, propertyID, requestedByID, req.ReportType, req.PeriodStart, req.PeriodEnd,
		exportFormat, fileName, csvContent, totalRows, checksum,
		metaBytes, now)

	if err != nil {
		return nil, fmt.Errorf("insert export job: %w", err)
	}

	return r.GetExportJob(ctx, propertyID, jobID)
}

func (r *FinanceRepository) GetExportJob(ctx context.Context, propertyID, jobID uuid.UUID) (*model.FinanceExportJob, error) {
	row := r.db.QueryRow(ctx, `
		SELECT j.id, j.property_id, j.requested_by, COALESCE(u.name, '') as requested_by_name,
		       j.report_type, j.period_start::text, j.period_end::text, j.export_format,
		       j.status, j.file_name, j.file_content, j.total_rows, j.checksum_sha256,
		       j.error_message, j.metadata, j.created_at, j.completed_at
		FROM finance_export_jobs j
		LEFT JOIN users u ON j.requested_by = u.id
		WHERE j.property_id = $1 AND j.id = $2
	`, propertyID, jobID)

	var j model.FinanceExportJob
	err := row.Scan(
		&j.ID, &j.PropertyID, &j.RequestedBy, &j.RequestedByName,
		&j.ReportType, &j.PeriodStart, &j.PeriodEnd, &j.ExportFormat,
		&j.Status, &j.FileName, &j.FileContent, &j.TotalRows, &j.ChecksumSHA256,
		&j.ErrorMessage, &j.Metadata, &j.CreatedAt, &j.CompletedAt,
	)
	if err != nil {
		return nil, err
	}
	return &j, nil
}

func (r *FinanceRepository) ListExportJobs(ctx context.Context, propertyID uuid.UUID) ([]model.FinanceExportJob, error) {
	rows, err := r.db.Query(ctx, `
		SELECT j.id, j.property_id, j.requested_by, COALESCE(u.name, '') as requested_by_name,
		       j.report_type, j.period_start::text, j.period_end::text, j.export_format,
		       j.status, j.file_name, '' as file_content, j.total_rows, j.checksum_sha256,
		       j.error_message, j.metadata, j.created_at, j.completed_at
		FROM finance_export_jobs j
		LEFT JOIN users u ON j.requested_by = u.id
		WHERE j.property_id = $1
		ORDER BY j.created_at DESC
		LIMIT 50
	`, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	jobs := make([]model.FinanceExportJob, 0)
	for rows.Next() {
		var j model.FinanceExportJob
		err := rows.Scan(
			&j.ID, &j.PropertyID, &j.RequestedBy, &j.RequestedByName,
			&j.ReportType, &j.PeriodStart, &j.PeriodEnd, &j.ExportFormat,
			&j.Status, &j.FileName, &j.FileContent, &j.TotalRows, &j.ChecksumSHA256,
			&j.ErrorMessage, &j.Metadata, &j.CreatedAt, &j.CompletedAt,
		)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// generateCSVReport builds formatted CSV content for export jobs.
func (r *FinanceRepository) generateCSVReport(ctx context.Context, propertyID uuid.UUID, reportType, periodStart, periodEnd string) (string, int, error) {
	buf := new(bytes.Buffer)
	w := csv.NewWriter(buf)

	totalRows := 0

	switch reportType {
	case "cash_flow":
		_ = w.Write([]string{"Tanggal", "Arus", "Tipe", "Referensi", "Deskripsi", "Jumlah (IDR)", "Status"})
		// Verified payments (Inflow)
		pRows, err := r.db.Query(ctx, `
			SELECT COALESCE(paid_at, created_at)::text, 'Kas Masuk (Inflow)', payment_method,
			       id::text, notes, amount_minor, status
			FROM payments
			WHERE property_id = $1
			  AND status IN ('verified', 'completed')
			  AND ((paid_at IS NOT NULL AND paid_at >= $2::date AND paid_at < ($3::date + INTERVAL '1 day'))
			    OR (paid_at IS NULL AND created_at >= $2::date AND created_at < ($3::date + INTERVAL '1 day')))
			ORDER BY created_at ASC
		`, propertyID, periodStart, periodEnd)
		if err == nil {
			defer pRows.Close()
			for pRows.Next() {
				var date, flow, method, ref, desc, status string
				var amount int64
				if err := pRows.Scan(&date, &flow, &method, &ref, &desc, &amount, &status); err == nil {
					_ = w.Write([]string{date, flow, method, ref, desc, fmt.Sprintf("%d", amount), status})
					totalRows++
				}
			}
		}

		// Paid expenses (Outflow)
		eRows, err := r.db.Query(ctx, `
			SELECT expense_date::text, 'Kas Keluar (Outflow)', category, expense_number,
			       title, amount_minor, status
			FROM expenses
			WHERE property_id = $1
			  AND status IN ('approved', 'paid')
			  AND expense_date >= $2::date AND expense_date <= $3::date
			ORDER BY expense_date ASC
		`, propertyID, periodStart, periodEnd)
		if err == nil {
			defer eRows.Close()
			for eRows.Next() {
				var date, flow, category, ref, title, status string
				var amount int64
				if err := eRows.Scan(&date, &flow, &category, &ref, &title, &amount, &status); err == nil {
					_ = w.Write([]string{date, flow, category, ref, title, fmt.Sprintf("%d", amount), status})
					totalRows++
				}
			}
		}

	case "receivables_aging":
		_ = w.Write([]string{"Nomor Invoice", "Penghuni", "Kamar", "Jatuh Tempo", "Hari Terlambat", "Kategori Umur", "Total Tagihan (IDR)", "Sisa Piutang (IDR)"})
		aging, err := r.GetReceivablesAging(ctx, propertyID)
		if err == nil {
			for _, inv := range aging.Invoices {
				_ = w.Write([]string{
					inv.InvoiceNumber, inv.TenantName, inv.RoomNumber,
					inv.DueAt.Format("2006-01-02"), fmt.Sprintf("%d", inv.DaysPastDue),
					inv.AgingBucket, fmt.Sprintf("%d", inv.TotalMinor), fmt.Sprintf("%d", inv.OutstandingMinor),
				})
				totalRows++
			}
		}

	case "expense_summary":
		_ = w.Write([]string{"Nomor Expense", "Tanggal", "Kategori", "Vendor", "Judul", "Deskripsi", "Jumlah (IDR)", "Status", "Metode Bayar"})
		eRows, err := r.db.Query(ctx, `
			SELECT expense_number, expense_date::text, category, vendor_name,
			       title, description, amount_minor, status, payment_method
			FROM expenses
			WHERE property_id = $1
			  AND expense_date >= $2::date AND expense_date <= $3::date
			ORDER BY expense_date DESC
		`, propertyID, periodStart, periodEnd)
		if err == nil {
			defer eRows.Close()
			for eRows.Next() {
				var expNum, date, cat, vendor, title, desc, status, method string
				var amount int64
				if err := eRows.Scan(&expNum, &date, &cat, &vendor, &title, &desc, &amount, &status, &method); err == nil {
					_ = w.Write([]string{expNum, date, cat, vendor, title, desc, fmt.Sprintf("%d", amount), status, method})
					totalRows++
				}
			}
		}

	default: // full_ledger or income_statement
		_ = w.Write([]string{"Tanggal", "Nomor Referensi", "Tipe Transaksi", "Kategori/Keterangan", "Pihak Terkait", "Kas Masuk (+)", "Kas Keluar (-)"})
		// Payments
		pRows, err := r.db.Query(ctx, `
			SELECT COALESCE(p.paid_at, p.created_at)::text, p.id::text, 'Pembayaran Masuk',
			       COALESCE(p.payment_method, 'Transfer'), COALESCE(u.name, 'Penghuni'), p.amount_minor, 0
			FROM payments p
			LEFT JOIN users u ON p.tenant_id = u.id
			WHERE p.property_id = $1 AND p.status IN ('verified', 'completed')
			  AND ((p.paid_at IS NOT NULL AND p.paid_at >= $2::date AND p.paid_at < ($3::date + INTERVAL '1 day'))
			    OR (p.paid_at IS NULL AND p.created_at >= $2::date AND p.created_at < ($3::date + INTERVAL '1 day')))
		`, propertyID, periodStart, periodEnd)
		if err == nil {
			defer pRows.Close()
			for pRows.Next() {
				var date, ref, transType, cat, party string
				var inAmt, outAmt int64
				if err := pRows.Scan(&date, &ref, &transType, &cat, &party, &inAmt, &outAmt); err == nil {
					_ = w.Write([]string{date, ref, transType, cat, party, fmt.Sprintf("%d", inAmt), fmt.Sprintf("%d", outAmt)})
					totalRows++
				}
			}
		}
		// Expenses
		eRows, err := r.db.Query(ctx, `
			SELECT expense_date::text, expense_number, 'Beban Pengeluaran',
			       category, COALESCE(vendor_name, 'Internal'), 0, amount_minor
			FROM expenses
			WHERE property_id = $1 AND status IN ('approved', 'paid')
			  AND expense_date >= $2::date AND expense_date <= $3::date
		`, propertyID, periodStart, periodEnd)
		if err == nil {
			defer eRows.Close()
			for eRows.Next() {
				var date, ref, transType, cat, party string
				var inAmt, outAmt int64
				if err := eRows.Scan(&date, &ref, &transType, &cat, &party, &inAmt, &outAmt); err == nil {
					_ = w.Write([]string{date, ref, transType, cat, party, fmt.Sprintf("%d", inAmt), fmt.Sprintf("%d", outAmt)})
					totalRows++
				}
			}
		}
	}

	w.Flush()
	if err := w.Error(); err != nil {
		return "", 0, err
	}

	return buf.String(), totalRows, nil
}

func formatCategoryLabel(cat string) string {
	switch cat {
	case "maintenance":
		return "Perawatan & Perbaikan"
	case "utilities":
		return "Listrik, Air & Internet"
	case "cleaning":
		return "Kebersihan & Sampah"
	case "supplies":
		return "Perlengkapan Kos"
	case "operational":
		return "Operasional Umum"
	case "tax_legal":
		return "Pajak & Legal"
	case "marketing":
		return "Pemasaran & Iklan"
	case "staff_salary":
		return "Gaji & Upah Staff"
	default:
		return "Lainnya"
	}
}

func (r *FinanceRepository) logFinancialAudit(ctx context.Context, propertyID uuid.UUID, actorID *uuid.UUID, action, entityType string, entityID uuid.UUID, amountMinor int64, reason string, beforeState, afterState any) {
	correlationID := ""
	if ctx != nil {
		if val := ctx.Value("correlation_id"); val != nil {
			if s, ok := val.(string); ok && s != "" {
				correlationID = s
			}
		}
	}
	if correlationID == "" {
		correlationID = uuid.New().String()
	}

	beforeJSON, _ := json.Marshal(beforeState)
	if len(beforeJSON) == 0 {
		beforeJSON = []byte("{}")
	}
	afterJSON, _ := json.Marshal(afterState)
	if len(afterJSON) == 0 {
		afterJSON = []byte("{}")
	}

	_, _ = r.db.Exec(ctx, `
		INSERT INTO financial_audit_logs (
			property_id, actor_id, action, entity_type, entity_id,
			amount_minor, reason, correlation_id, before_state, after_state
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, propertyID, actorID, action, entityType, entityID, amountMinor, reason, correlationID, beforeJSON, afterJSON)
}
