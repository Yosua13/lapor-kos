package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/billing"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrCheckoutNotFound      = errors.New("checkout case not found")
	ErrCheckoutAlreadyExists  = errors.New("an active checkout case already exists for this contract")
	ErrCheckoutTerminalState  = errors.New("checkout case is in a terminal state and cannot be modified")
	ErrHandoverIncomplete    = errors.New("key handover and inspection must be completed before checkout, or an override reason must be provided")
	ErrContractNotActive     = errors.New("contract is not currently active")
	ErrCheckoutInvalidStatus = errors.New("invalid status transition for checkout case")
)

type CheckoutRepository struct {
	db *pgxpool.Pool
}

func NewCheckoutRepository(db *pgxpool.Pool) *CheckoutRepository {
	return &CheckoutRepository{db: db}
}

// GetActiveContractForTenant retrieves an active contract for a tenant in the property.
func (r *CheckoutRepository) GetActiveContractForTenant(ctx context.Context, propertyID, tenantID uuid.UUID) (*model.Contract, error) {
	row := r.db.QueryRow(ctx, `
		SELECT c.id, c.property_id, c.user_id, c.room_id, c.start_date, c.end_date,
		       ROUND(c.monthly_rent)::bigint, ROUND(COALESCE(c.deposit, 0))::bigint,
		       c.status
		FROM contracts c
		WHERE c.property_id = $1 AND c.user_id = $2 AND c.status = 'active'
		LIMIT 1`, propertyID, tenantID)

	var c model.Contract
	var monthlyRent, deposit int64
	var startDate, endDate time.Time
	err := row.Scan(&c.ID, &c.PropertyID, &c.UserID, &c.RoomID, &startDate, &endDate, &monthlyRent, &deposit, &c.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrContractNotActive
	}
	if err != nil {
		return nil, err
	}
	c.StartDate = startDate
	c.EndDate = endDate
	c.MonthlyRent = float64(monthlyRent)
	c.Deposit = float64(deposit)
	return &c, nil
}

// CreateCheckoutNotice registers a new checkout notice from a tenant or staff.
func (r *CheckoutRepository) CreateCheckoutNotice(ctx context.Context, propertyID, actorID uuid.UUID, req model.CreateCheckoutNoticeRequest) (*model.CheckoutCase, error) {
	contractID, err := uuid.Parse(req.ContractID)
	if err != nil {
		return nil, fmt.Errorf("invalid contract_id: %w", err)
	}

	scheduledDate, err := time.Parse("2006-01-02", req.ScheduledCheckoutDate)
	if err != nil {
		return nil, fmt.Errorf("invalid scheduled_checkout_date: %w", err)
	}

	// Verify contract status and ownership
	var tenantID, roomID uuid.UUID
	var contractStatus string
	var depositHeld int64
	err = r.db.QueryRow(ctx, `
		SELECT user_id, room_id, status, ROUND(COALESCE(deposit, 0))::bigint
		FROM contracts
		WHERE property_id = $1 AND id = $2`, propertyID, contractID).Scan(&tenantID, &roomID, &contractStatus, &depositHeld)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("contract not found in property")
	}
	if err != nil {
		return nil, err
	}
	if contractStatus != "active" && contractStatus != "scheduled" {
		return nil, ErrContractNotActive
	}

	// Check if active checkout already exists
	var existingID uuid.UUID
	err = r.db.QueryRow(ctx, `
		SELECT id FROM checkout_cases
		WHERE contract_id = $1 AND status NOT IN ('completed', 'cancelled')
		LIMIT 1`, contractID).Scan(&existingID)
	if err == nil {
		return nil, ErrCheckoutAlreadyExists
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	caseID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO checkout_cases (
			id, property_id, contract_id, tenant_id, room_id, status,
			scheduled_checkout_date, reason, forwarding_address,
			bank_name, bank_account_number, bank_account_holder,
			created_by, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, 'submitted',
			$6, $7, $8,
			$9, $10, $11,
			$12, NOW(), NOW()
		)`,
		caseID, propertyID, contractID, tenantID, roomID,
		scheduledDate, strings.TrimSpace(req.Reason), strings.TrimSpace(req.ForwardingAddress),
		strings.TrimSpace(req.BankName), strings.TrimSpace(req.BankAccountNumber), strings.TrimSpace(req.BankAccountHolder),
		actorID,
	)
	if err != nil {
		return nil, err
	}

	// Create initial draft settlement record
	settlementID := uuid.New()
	initialSnapshot, _ := json.Marshal(map[string]any{
		"contract_id":        contractID,
		"deposit_held_minor": depositHeld,
		"created_at":         time.Now().UTC().Format(time.RFC3339),
	})
	_, err = tx.Exec(ctx, `
		INSERT INTO checkout_settlements (
			id, property_id, checkout_id, currency, deposit_held_minor,
			net_settlement_minor, settlement_type, deposit_status, calculation_snapshot
		) VALUES (
			$1, $2, $3, 'IDR', $4,
			$4, 'refund', 'pending', $5
		)`,
		settlementID, propertyID, caseID, depositHeld, initialSnapshot,
	)
	if err != nil {
		return nil, err
	}

	// Insert notification into outbox
	outboxPayload, _ := json.Marshal(map[string]any{
		"checkout_id":             caseID,
		"property_id":             propertyID,
		"contract_id":             contractID,
		"tenant_id":               tenantID,
		"scheduled_checkout_date": req.ScheduledCheckoutDate,
		"event":                   "checkout_notice_submitted",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload, status)
		VALUES ($1, 'checkout_notice_submitted', 'checkout', $2, $3, 'pending')`,
		propertyID, caseID, outboxPayload)

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetCheckoutCase(ctx, propertyID, caseID)
}

const checkoutSelect = `
	SELECT cc.id, cc.property_id, cc.contract_id, cc.tenant_id, cc.room_id, cc.status,
	       cc.scheduled_checkout_date, cc.actual_checkout_date, cc.reason, cc.forwarding_address,
	       cc.bank_name, cc.bank_account_number, cc.bank_account_holder,
	       cc.inspection_notes, cc.inspected_by, cc.inspected_at,
	       cc.key_returned, cc.key_returned_at, cc.room_override, cc.room_override_reason,
	       cc.approved_by, cc.approved_at, cc.completed_by, cc.completed_at,
	       cc.cancellation_reason, cc.created_by, cc.created_at, cc.updated_at,
	       COALESCE(u.name, ''), COALESCE(u.email, ''), COALESCE(u.phone, ''),
	       COALESCE(r.room_number, ''), COALESCE(r.floor, ''),
	       COALESCE(c.start_date::text, ''), COALESCE(c.end_date::text, '')
	FROM checkout_cases cc
	JOIN users u ON u.id = cc.tenant_id
	JOIN rooms r ON r.id = cc.room_id
	JOIN contracts c ON c.id = cc.contract_id
`

func scanCheckoutCase(row interface{ Scan(...any) error }) (*model.CheckoutCase, error) {
	var cc model.CheckoutCase
	var schedDate time.Time
	var actDate *time.Time

	err := row.Scan(
		&cc.ID, &cc.PropertyID, &cc.ContractID, &cc.TenantID, &cc.RoomID, &cc.Status,
		&schedDate, &actDate, &cc.Reason, &cc.ForwardingAddress,
		&cc.BankName, &cc.BankAccountNumber, &cc.BankAccountHolder,
		&cc.InspectionNotes, &cc.InspectedBy, &cc.InspectedAt,
		&cc.KeyReturned, &cc.KeyReturnedAt, &cc.RoomOverride, &cc.RoomOverrideReason,
		&cc.ApprovedBy, &cc.ApprovedAt, &cc.CompletedBy, &cc.CompletedAt,
		&cc.CancellationReason, &cc.CreatedBy, &cc.CreatedAt, &cc.UpdatedAt,
		&cc.TenantName, &cc.TenantEmail, &cc.TenantPhone,
		&cc.RoomNumber, &cc.RoomFloor,
		&cc.ContractStart, &cc.ContractEnd,
	)
	if err != nil {
		return nil, err
	}
	cc.ScheduledCheckoutDate = schedDate.Format("2006-01-02")
	if actDate != nil {
		formatted := actDate.Format("2006-01-02")
		cc.ActualCheckoutDate = &formatted
	}
	return &cc, nil
}

// GetCheckoutCase returns a full checkout case with inspections and settlement details.
func (r *CheckoutRepository) GetCheckoutCase(ctx context.Context, propertyID, id uuid.UUID) (*model.CheckoutCase, error) {
	row := r.db.QueryRow(ctx, checkoutSelect+` WHERE cc.property_id = $1 AND cc.id = $2`, propertyID, id)
	cc, err := scanCheckoutCase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCheckoutNotFound
	}
	if err != nil {
		return nil, err
	}

	// Load inspections
	inspRows, err := r.db.Query(ctx, `
		SELECT id, property_id, checkout_id, item_name, condition, repair_cost_minor, photo_url, notes, inspected_at
		FROM checkout_inspections
		WHERE property_id = $1 AND checkout_id = $2
		ORDER BY inspected_at ASC, item_name ASC`, propertyID, id)
	if err == nil {
		defer inspRows.Close()
		cc.Inspections = make([]model.CheckoutInspection, 0)
		for inspRows.Next() {
			var item model.CheckoutInspection
			if scanErr := inspRows.Scan(&item.ID, &item.PropertyID, &item.CheckoutID, &item.ItemName, &item.Condition, &item.RepairCostMinor, &item.PhotoURL, &item.Notes, &item.InspectedAt); scanErr == nil {
				cc.Inspections = append(cc.Inspections, item)
			}
		}
	}

	// Load settlement statement
	settleRow := r.db.QueryRow(ctx, `
		SELECT id, property_id, checkout_id, currency, deposit_held_minor,
		       unpaid_invoices_minor, prorata_rent_minor, damage_charges_minor,
		       utility_charges_minor, credit_balance_minor, other_charges_minor,
		       net_settlement_minor, settlement_type, deposit_status,
		       refund_request_id, final_invoice_id, calculation_snapshot,
		       created_at, updated_at
		FROM checkout_settlements
		WHERE property_id = $1 AND checkout_id = $2`, propertyID, id)

	var s model.CheckoutSettlement
	var rawSnapshot []byte
	err = settleRow.Scan(
		&s.ID, &s.PropertyID, &s.CheckoutID, &s.Currency, &s.DepositHeldMinor,
		&s.UnpaidInvoicesMinor, &s.ProrataRentMinor, &s.DamageChargesMinor,
		&s.UtilityChargesMinor, &s.CreditBalanceMinor, &s.OtherChargesMinor,
		&s.NetSettlementMinor, &s.SettlementType, &s.DepositStatus,
		&s.RefundRequestID, &s.FinalInvoiceID, &rawSnapshot,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err == nil {
		_ = json.Unmarshal(rawSnapshot, &s.CalculationSnapshot)
		cc.Settlement = &s
	}

	return cc, nil
}

// GetCheckoutCaseForTenant returns a checkout case scoped to tenant.
func (r *CheckoutRepository) GetCheckoutCaseForTenant(ctx context.Context, tenantID, id uuid.UUID) (*model.CheckoutCase, error) {
	row := r.db.QueryRow(ctx, checkoutSelect+` WHERE cc.tenant_id = $1 AND cc.id = $2`, tenantID, id)
	cc, err := scanCheckoutCase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCheckoutNotFound
	}
	if err != nil {
		return nil, err
	}
	return r.GetCheckoutCase(ctx, cc.PropertyID, id)
}

// ListCheckoutCases returns paginated checkout cases for property management.
func (r *CheckoutRepository) ListCheckoutCases(ctx context.Context, propertyID uuid.UUID, filter model.CheckoutListFilter) (*model.CheckoutListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}

	where := []string{"cc.property_id = $1"}
	args := []any{propertyID}

	if filter.Status != "" {
		args = append(args, filter.Status)
		where = append(where, fmt.Sprintf("cc.status = $%d", len(args)))
	}
	if filter.TenantID != nil {
		args = append(args, *filter.TenantID)
		where = append(where, fmt.Sprintf("cc.tenant_id = $%d", len(args)))
	}
	if filter.RoomID != nil {
		args = append(args, *filter.RoomID)
		where = append(where, fmt.Sprintf("cc.room_id = $%d", len(args)))
	}
	if filter.StartDate != "" {
		if t, err := time.Parse("2006-01-02", filter.StartDate); err == nil {
			args = append(args, t)
			where = append(where, fmt.Sprintf("cc.scheduled_checkout_date >= $%d", len(args)))
		}
	}
	if filter.EndDate != "" {
		if t, err := time.Parse("2006-01-02", filter.EndDate); err == nil {
			args = append(args, t)
			where = append(where, fmt.Sprintf("cc.scheduled_checkout_date <= $%d", len(args)))
		}
	}

	whereClause := strings.Join(where, " AND ")

	var total int
	countQuery := `SELECT COUNT(*) FROM checkout_cases cc WHERE ` + whereClause
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	offset := (filter.Page - 1) * filter.PageSize
	args = append(args, filter.PageSize, offset)
	query := checkoutSelect + ` WHERE ` + whereClause + fmt.Sprintf(` ORDER BY cc.created_at DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.CheckoutCase, 0)
	for rows.Next() {
		cc, scanErr := scanCheckoutCase(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, *cc)
	}

	totalPages := (total + filter.PageSize - 1) / filter.PageSize
	return &model.CheckoutListResponse{
		Items:      items,
		Page:       filter.Page,
		PageSize:   filter.PageSize,
		TotalItems: total,
		TotalPages: totalPages,
	}, rows.Err()
}

// ListCheckoutCasesForTenant lists all checkout cases belonging to a tenant.
func (r *CheckoutRepository) ListCheckoutCasesForTenant(ctx context.Context, tenantID uuid.UUID) ([]model.CheckoutCase, error) {
	rows, err := r.db.Query(ctx, checkoutSelect+` WHERE cc.tenant_id = $1 ORDER BY cc.created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]model.CheckoutCase, 0)
	for rows.Next() {
		cc, scanErr := scanCheckoutCase(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, *cc)
	}
	return items, rows.Err()
}

// RecordInspections records checklist items, meter readings, and key handover status.
func (r *CheckoutRepository) RecordInspections(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req model.RecordInspectionRequest) (*model.CheckoutCase, error) {
	caseObj, err := r.GetCheckoutCase(ctx, propertyID, checkoutID)
	if err != nil {
		return nil, err
	}
	if caseObj.Status == "completed" || caseObj.Status == "cancelled" {
		return nil, ErrCheckoutTerminalState
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Delete old inspections and insert updated ones
	_, err = tx.Exec(ctx, `DELETE FROM checkout_inspections WHERE property_id = $1 AND checkout_id = $2`, propertyID, checkoutID)
	if err != nil {
		return nil, err
	}

	var totalDamageCost int64 = 0
	for _, item := range req.Items {
		cost := max(0, item.RepairCostMinor)
		totalDamageCost += cost
		_, err = tx.Exec(ctx, `
			INSERT INTO checkout_inspections (
				id, property_id, checkout_id, item_name, condition, repair_cost_minor, photo_url, notes, inspected_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, NOW()
			)`,
			uuid.New(), propertyID, checkoutID, strings.TrimSpace(item.ItemName),
			item.Condition, cost, strings.TrimSpace(item.PhotoURL), strings.TrimSpace(item.Notes),
		)
		if err != nil {
			return nil, err
		}
	}

	// Calculate utility costs from readings
	var totalUtilityCost int64 = 0
	if req.ElectricityReading != nil {
		charge := billing.CalculateUtilityUsage(req.ElectricityReading.PreviousValue, req.ElectricityReading.CurrentValue, req.ElectricityReading.UnitPriceMinor)
		totalUtilityCost += charge
	}
	if req.WaterReading != nil {
		charge := billing.CalculateUtilityUsage(req.WaterReading.PreviousValue, req.WaterReading.CurrentValue, req.WaterReading.UnitPriceMinor)
		totalUtilityCost += charge
	}

	// Update checkout_cases
	var keyReturnedAt *time.Time
	if req.KeyReturned {
		now := time.Now()
		keyReturnedAt = &now
	}
	newStatus := "inspection_completed"
	_, err = tx.Exec(ctx, `
		UPDATE checkout_cases
		SET status = $1, inspection_notes = $2, inspected_by = $3, inspected_at = NOW(),
		    key_returned = $4, key_returned_at = COALESCE(key_returned_at, $5), updated_at = NOW()
		WHERE property_id = $6 AND id = $7`,
		newStatus, strings.TrimSpace(req.InspectionNotes), actorID,
		req.KeyReturned, keyReturnedAt, propertyID, checkoutID,
	)
	if err != nil {
		return nil, err
	}

	// Compute updated settlement
	preview, err := r.previewSettlementWithTx(ctx, tx, propertyID, caseObj, totalDamageCost, totalUtilityCost)
	if err != nil {
		return nil, err
	}

	rawSnapshot, _ := json.Marshal(preview.Snapshot)
	_, err = tx.Exec(ctx, `
		INSERT INTO checkout_settlements (
			id, property_id, checkout_id, currency, deposit_held_minor,
			unpaid_invoices_minor, prorata_rent_minor, damage_charges_minor,
			utility_charges_minor, credit_balance_minor, other_charges_minor,
			net_settlement_minor, settlement_type, deposit_status, calculation_snapshot, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW()
		)
		ON CONFLICT (checkout_id) DO UPDATE SET
			unpaid_invoices_minor = EXCLUDED.unpaid_invoices_minor,
			prorata_rent_minor = EXCLUDED.prorata_rent_minor,
			damage_charges_minor = EXCLUDED.damage_charges_minor,
			utility_charges_minor = EXCLUDED.utility_charges_minor,
			credit_balance_minor = EXCLUDED.credit_balance_minor,
			other_charges_minor = EXCLUDED.other_charges_minor,
			net_settlement_minor = EXCLUDED.net_settlement_minor,
			settlement_type = EXCLUDED.settlement_type,
			deposit_status = EXCLUDED.deposit_status,
			calculation_snapshot = EXCLUDED.calculation_snapshot,
			updated_at = NOW()`,
		uuid.New(), propertyID, checkoutID, preview.Currency, preview.DepositHeldMinor,
		preview.UnpaidInvoicesMinor, preview.ProrataRentMinor, preview.DamageChargesMinor,
		preview.UtilityChargesMinor, preview.CreditBalanceMinor, preview.OtherChargesMinor,
		preview.NetSettlementMinor, preview.SettlementType, preview.DepositStatus, rawSnapshot,
	)
	if err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetCheckoutCase(ctx, propertyID, checkoutID)
}

func (r *CheckoutRepository) previewSettlementWithTx(ctx context.Context, tx pgx.Tx, propertyID uuid.UUID, caseObj *model.CheckoutCase, damageCharges, utilityCharges int64) (*model.SettlementCalculation, error) {
	// 1. Contract deposit
	var depositHeld int64
	err := tx.QueryRow(ctx, `
		SELECT ROUND(COALESCE(deposit, 0))::bigint FROM contracts WHERE property_id = $1 AND id = $2`,
		propertyID, caseObj.ContractID).Scan(&depositHeld)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// 2. Unpaid invoices
	var unpaidInvoices int64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(i.total_minor - COALESCE(alloc.paid, 0)), 0)
		FROM invoices i
		LEFT JOIN (
			SELECT invoice_id, SUM(amount_minor) AS paid
			FROM invoice_allocations
			WHERE status = 'valid'
			GROUP BY invoice_id
		) alloc ON alloc.invoice_id = i.id
		WHERE i.property_id = $1 AND i.contract_id = $2 AND i.status IN ('issued', 'partially_paid')`,
		propertyID, caseObj.ContractID).Scan(&unpaidInvoices)
	if err != nil {
		return nil, err
	}

	// 3. Tenant Credit Balance
	var creditBalance int64
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(remaining_amount_minor), 0)
		FROM tenant_credits
		WHERE property_id = $1 AND tenant_id = $2 AND status = 'active'`,
		propertyID, caseObj.TenantID).Scan(&creditBalance)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	input := billing.SettlementCalcInput{
		DepositHeldMinor:    depositHeld,
		CreditBalanceMinor:  creditBalance,
		UnpaidInvoicesMinor: unpaidInvoices,
		ProrataRentMinor:    0,
		DamageChargesMinor:  damageCharges,
		UtilityChargesMinor: utilityCharges,
		OtherChargesMinor:   0,
		Currency:            "IDR",
	}

	res := billing.CalculateCheckoutSettlement(input)
	return &res, nil
}

// PreviewSettlement calculates the latest live financial settlement for a checkout case.
func (r *CheckoutRepository) PreviewSettlement(ctx context.Context, propertyID, checkoutID uuid.UUID) (*model.SettlementCalculation, error) {
	caseObj, err := r.GetCheckoutCase(ctx, propertyID, checkoutID)
	if err != nil {
		return nil, err
	}

	var damageCharges int64 = 0
	for _, insp := range caseObj.Inspections {
		damageCharges += insp.RepairCostMinor
	}

	var utilityCharges int64 = 0
	if caseObj.Settlement != nil {
		utilityCharges = caseObj.Settlement.UtilityChargesMinor
	}

	// Run read query using db pool
	var depositHeld int64
	_ = r.db.QueryRow(ctx, `SELECT ROUND(COALESCE(deposit, 0))::bigint FROM contracts WHERE property_id = $1 AND id = $2`, propertyID, caseObj.ContractID).Scan(&depositHeld)

	var unpaidInvoices int64
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(i.total_minor - COALESCE(alloc.paid, 0)), 0)
		FROM invoices i
		LEFT JOIN (
			SELECT invoice_id, SUM(amount_minor) AS paid
			FROM invoice_allocations
			WHERE status = 'valid'
			GROUP BY invoice_id
		) alloc ON alloc.invoice_id = i.id
		WHERE i.property_id = $1 AND i.contract_id = $2 AND i.status IN ('issued', 'partially_paid')`,
		propertyID, caseObj.ContractID).Scan(&unpaidInvoices)

	var creditBalance int64
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(remaining_amount_minor), 0)
		FROM tenant_credits
		WHERE property_id = $1 AND tenant_id = $2 AND status = 'active'`,
		propertyID, caseObj.TenantID).Scan(&creditBalance)

	input := billing.SettlementCalcInput{
		DepositHeldMinor:    depositHeld,
		CreditBalanceMinor:  creditBalance,
		UnpaidInvoicesMinor: unpaidInvoices,
		ProrataRentMinor:    0,
		DamageChargesMinor:  damageCharges,
		UtilityChargesMinor: utilityCharges,
		OtherChargesMinor:   0,
		Currency:            "IDR",
	}

	res := billing.CalculateCheckoutSettlement(input)
	return &res, nil
}

// ApproveSettlement confirms that the inspection and settlement amounts are audited and approved.
func (r *CheckoutRepository) ApproveSettlement(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, notes string) (*model.CheckoutCase, error) {
	caseObj, err := r.GetCheckoutCase(ctx, propertyID, checkoutID)
	if err != nil {
		return nil, err
	}
	if caseObj.Status == "completed" || caseObj.Status == "cancelled" {
		return nil, ErrCheckoutTerminalState
	}

	_, err = r.db.Exec(ctx, `
		UPDATE checkout_cases
		SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
		WHERE property_id = $2 AND id = $3`, actorID, propertyID, checkoutID)
	if err != nil {
		return nil, err
	}

	return r.GetCheckoutCase(ctx, propertyID, checkoutID)
}

// ExecuteCheckout finishes the checkout workflow atomically (AC 1, AC 2, AC 3, AC 4, AC 5).
func (r *CheckoutRepository) ExecuteCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req model.ExecuteCheckoutRequest) (*model.CheckoutCase, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Lock checkout case
	row := tx.QueryRow(ctx, checkoutSelect+` WHERE cc.property_id = $1 AND cc.id = $2 FOR UPDATE`, propertyID, checkoutID)
	caseObj, err := scanCheckoutCase(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrCheckoutNotFound
	}
	if err != nil {
		return nil, err
	}

	if caseObj.Status == "completed" || caseObj.Status == "cancelled" {
		return nil, ErrCheckoutTerminalState
	}

	// AC 1 ENFORCEMENT:
	// Room must NOT become available before inspection and handover are completed,
	// unless an explicit override reason is provided by the manager/owner.
	isKeyHandedOver := caseObj.KeyReturned
	hasOverride := req.RoomOverride && strings.TrimSpace(req.RoomOverrideReason) != ""
	if !isKeyHandedOver && !hasOverride {
		return nil, ErrHandoverIncomplete
	}

	actualDate := time.Now().Format("2006-01-02")
	if req.ActualCheckoutDate != "" {
		if _, parseErr := time.Parse("2006-01-02", req.ActualCheckoutDate); parseErr == nil {
			actualDate = req.ActualCheckoutDate
		}
	}

	// 1. Final settlement calculation
	var damageCost int64 = 0
	_ = tx.QueryRow(ctx, `SELECT COALESCE(SUM(repair_cost_minor), 0) FROM checkout_inspections WHERE checkout_id = $1`, checkoutID).Scan(&damageCost)

	var utilityCost int64 = 0
	_ = tx.QueryRow(ctx, `SELECT COALESCE(utility_charges_minor, 0) FROM checkout_settlements WHERE checkout_id = $1`, checkoutID).Scan(&utilityCost)

	calc, err := r.previewSettlementWithTx(ctx, tx, propertyID, caseObj, damageCost, utilityCost)
	if err != nil {
		return nil, err
	}

	// AC 2: Deposit resolves with zero balance or an open refund request
	var refundRequestID *uuid.UUID
	var finalInvoiceID *uuid.UUID

	if calc.NetSettlementMinor > 0 {
		// Refund case to tenant
		refID := uuid.New()
		refundReason := fmt.Sprintf("Pengembalian sisa deposit checkout kamar %s", caseObj.RoomNumber)
		_, err = tx.Exec(ctx, `
			INSERT INTO refund_requests (
				id, property_id, checkout_id, tenant_id, amount_minor, status,
				reason, bank_name, bank_account_number, bank_account_holder, notes, created_at
			) VALUES (
				$1, $2, $3, $4, $5, 'requested',
				$6, $7, $8, $9, 'Otomatis dari settlement checkout', NOW()
			)`,
			refID, propertyID, checkoutID, caseObj.TenantID, calc.RefundAmountMinor,
			refundReason, caseObj.BankName, caseObj.BankAccountNumber, caseObj.BankAccountHolder,
		)
		if err != nil {
			return nil, fmt.Errorf("create refund request: %w", err)
		}
		refundRequestID = &refID
	} else if calc.NetSettlementMinor < 0 {
		// Outstanding invoice to tenant for damage/utilities beyond deposit
		invID := uuid.New()
		invNumber := fmt.Sprintf("INV-SETTLE-%s", strings.ToUpper(strings.ReplaceAll(checkoutID.String(), "-", ""))[:8])
		invDue := time.Now().AddDate(0, 0, 7) // 7 days payment term
		invSnapshot, _ := json.Marshal(calc.Snapshot)
		idempKey := fmt.Sprintf("checkout_settlement:%s", checkoutID)

		_, err = tx.Exec(ctx, `
			INSERT INTO invoices (
				id, property_id, contract_id, tenant_id, invoice_number,
				billing_period, invoice_type, status, currency, due_at,
				calculation_snapshot, idempotency_key, issued_at, created_by
			) VALUES (
				$1, $2, $3, $4, $5,
				NOW(), 'final_settlement', 'issued', 'IDR', $6,
				$7, $8, NOW(), $9
			)`,
			invID, propertyID, caseObj.ContractID, caseObj.TenantID, invNumber,
			invDue, invSnapshot, idempKey, actorID,
		)
		if err != nil {
			return nil, fmt.Errorf("create settlement invoice: %w", err)
		}

		// Insert item for the invoice
		_, err = tx.Exec(ctx, `
			INSERT INTO invoice_items (
				property_id, invoice_id, item_type, description, unit_amount_minor, amount_minor, reason, metadata, created_by
			) VALUES (
				$1, $2, 'damage_deduction', 'Kekurangan biaya settlement checkout', $3, $3, 'Kekurangan deposit untuk pelunasan tagihan checkout', $4, $5
			)`,
			propertyID, invID, calc.InvoiceAmountMinor, invSnapshot, actorID,
		)
		if err != nil {
			return nil, fmt.Errorf("create settlement invoice item: %w", err)
		}
		finalInvoiceID = &invID
	}

	// Update settlement record
	calcSnapshot, _ := json.Marshal(calc.Snapshot)
	_, err = tx.Exec(ctx, `
		UPDATE checkout_settlements
		SET unpaid_invoices_minor = $1, damage_charges_minor = $2, utility_charges_minor = $3,
		    credit_balance_minor = $4, net_settlement_minor = $5, settlement_type = $6,
		    deposit_status = $7, refund_request_id = $8, final_invoice_id = $9,
		    calculation_snapshot = $10, updated_at = NOW()
		WHERE checkout_id = $11`,
		calc.UnpaidInvoicesMinor, calc.DamageChargesMinor, calc.UtilityChargesMinor,
		calc.CreditBalanceMinor, calc.NetSettlementMinor, calc.SettlementType,
		calc.DepositStatus, refundRequestID, finalInvoiceID,
		calcSnapshot, checkoutID,
	)
	if err != nil {
		return nil, err
	}

	// 2. Close active occupancy period
	actualDateParsed, _ := time.Parse("2006-01-02", actualDate)
	_, err = tx.Exec(ctx, `
		UPDATE occupancy_periods
		SET closed_at = NOW(), end_date = LEAST(end_date, $1::date)
		WHERE property_id = $2 AND contract_id = $3 AND closed_at IS NULL`,
		actualDateParsed, propertyID, caseObj.ContractID)
	if err != nil {
		return nil, fmt.Errorf("close occupancy period: %w", err)
	}

	// 3. Transition contract status (AC 3: historical contract and invoices preserved)
	newContractStatus := "ended"
	var contractEndDate time.Time
	_ = tx.QueryRow(ctx, `SELECT end_date FROM contracts WHERE id = $1`, caseObj.ContractID).Scan(&contractEndDate)
	if !contractEndDate.IsZero() && actualDateParsed.Before(contractEndDate) {
		newContractStatus = "terminated"
	}
	_, err = tx.Exec(ctx, `
		UPDATE contracts
		SET status = $1
		WHERE property_id = $2 AND id = $3`, newContractStatus, propertyID, caseObj.ContractID)
	if err != nil {
		return nil, fmt.Errorf("update contract status: %w", err)
	}

	// Record contract event
	contractEventMetadata, _ := json.Marshal(map[string]any{
		"checkout_id":          checkoutID,
		"actual_checkout_date": actualDate,
		"net_settlement_minor": calc.NetSettlementMinor,
		"settlement_type":      calc.SettlementType,
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO contract_events (
			property_id, contract_id, event_type, to_status, reason, actor_id, metadata
		) VALUES (
			$1, $2, 'checkout_completed', $3, 'Penyelesaian checkout dan settlement hunian', $4, $5
		)`,
		propertyID, caseObj.ContractID, newContractStatus, actorID, contractEventMetadata,
	)

	// 4. Cancel future recurring invoices that have not fallen due
	_, _ = tx.Exec(ctx, `
		UPDATE invoices
		SET status = 'cancelled'
		WHERE property_id = $1 AND contract_id = $2 AND invoice_type = 'recurring'
		  AND billing_period > $3::date AND status = 'issued'`,
		propertyID, caseObj.ContractID, actualDateParsed)

	// 5. Update room status (AC 1)
	// Default to cleaning unless override explicitly specifies available
	targetRoomStatus := "cleaning"
	if hasOverride && (req.TargetRoomStatus == "available" || req.TargetRoomStatus == "maintenance") {
		targetRoomStatus = req.TargetRoomStatus
	}
	_, err = tx.Exec(ctx, `
		UPDATE rooms
		SET status = $1
		WHERE property_id = $2 AND id = $3`, targetRoomStatus, propertyID, caseObj.RoomID)
	if err != nil {
		return nil, fmt.Errorf("update room status: %w", err)
	}

	// 6. AC 4: Revoke tenant session and set profile to inactive
	if err = revokeTenantSessionForProperty(ctx, tx, propertyID, caseObj.TenantID, "checkout_completed"); err != nil {
		return nil, fmt.Errorf("revoke tenant session: %w", err)
	}

	// 7. Update checkout_cases to completed
	_, err = tx.Exec(ctx, `
		UPDATE checkout_cases
		SET status = 'completed', actual_checkout_date = $1::date,
		    room_override = $2, room_override_reason = $3,
		    completed_by = $4, completed_at = NOW(), updated_at = NOW()
		WHERE property_id = $5 AND id = $6`,
		actualDateParsed, hasOverride, strings.TrimSpace(req.RoomOverrideReason),
		actorID, propertyID, checkoutID)
	if err != nil {
		return nil, fmt.Errorf("complete checkout case: %w", err)
	}

	// 8. Notification outbox event
	notifPayload, _ := json.Marshal(map[string]any{
		"checkout_id":          checkoutID,
		"property_id":          propertyID,
		"tenant_id":            caseObj.TenantID,
		"room_id":              caseObj.RoomID,
		"room_number":          caseObj.RoomNumber,
		"contract_id":          caseObj.ContractID,
		"actual_checkout_date": actualDate,
		"net_settlement_minor": calc.NetSettlementMinor,
		"settlement_type":      calc.SettlementType,
		"room_status":          targetRoomStatus,
		"event":                "checkout_completed",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload, status)
		VALUES ($1, 'checkout_completed', 'checkout', $2, $3, 'pending')`,
		propertyID, checkoutID, notifPayload)

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetCheckoutCase(ctx, propertyID, checkoutID)
}

// CancelCheckout marks a checkout case as cancelled.
func (r *CheckoutRepository) CancelCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, reason string) error {
	caseObj, err := r.GetCheckoutCase(ctx, propertyID, checkoutID)
	if err != nil {
		return err
	}
	if caseObj.Status == "completed" || caseObj.Status == "cancelled" {
		return ErrCheckoutTerminalState
	}

	_, err = r.db.Exec(ctx, `
		UPDATE checkout_cases
		SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW()
		WHERE property_id = $2 AND id = $3`,
		strings.TrimSpace(reason), propertyID, checkoutID)
	return err
}

// OverrideRoomStatus sets room status with an explicit audited reason (AC 1).
func (r *CheckoutRepository) OverrideRoomStatus(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, targetStatus, reason string) error {
	if strings.TrimSpace(reason) == "" {
		return errors.New("override reason is required")
	}
	validStatuses := map[string]bool{"available": true, "cleaning": true, "maintenance": true}
	if !validStatuses[targetStatus] {
		return errors.New("invalid target room status")
	}

	caseObj, err := r.GetCheckoutCase(ctx, propertyID, checkoutID)
	if err != nil {
		return err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	_, err = tx.Exec(ctx, `
		UPDATE checkout_cases
		SET room_override = TRUE, room_override_reason = $1, updated_at = NOW()
		WHERE property_id = $2 AND id = $3`,
		strings.TrimSpace(reason), propertyID, checkoutID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		UPDATE rooms
		SET status = $1
		WHERE property_id = $2 AND id = $3`,
		targetStatus, propertyID, caseObj.RoomID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
