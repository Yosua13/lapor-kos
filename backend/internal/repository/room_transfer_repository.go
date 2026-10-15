package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/billing"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRoomTransferNotFound      = errors.New("pengajuan pindah kamar tidak ditemukan")
	ErrRoomTransferInvalidState  = errors.New("status pengajuan pindah kamar tidak valid untuk aksi ini")
	ErrRoomTransferSameRoom      = errors.New("kamar tujuan tidak boleh sama dengan kamar saat ini")
	ErrRoomTransferUnavailable   = errors.New("kamar target sudah terisi atau memiliki reservasi pada periode tersebut")
	ErrRoomTransferInvalidDates  = errors.New("tanggal efektif di luar rentang durasi kontrak")
	ErrRoomTransferNoContract    = errors.New("tidak ditemukan kontrak aktif untuk penghuni ini")
	ErrRoomTransferUnauthorized  = errors.New("tidak memiliki izin untuk pengajuan pindah kamar ini")
	ErrRoomTransferConflict      = errors.New("terdapat pengajuan pindah kamar lain yang bertabrakan pada kamar dan periode tersebut")
)

type RoomTransferRepository struct {
	db *pgxpool.Pool
}

func NewRoomTransferRepository(db *pgxpool.Pool) *RoomTransferRepository {
	return &RoomTransferRepository{db: db}
}

type contractRoomInfo struct {
	ContractID      uuid.UUID
	PropertyID      uuid.UUID
	TenantID        uuid.UUID
	TenantName      string
	TenantEmail     string
	TenantPhone     string
	RoomID          uuid.UUID
	RoomNumber      string
	RoomPriceMinor  int64
	StartDate       time.Time
	EndDate         time.Time
	MonthlyRent     float64
	DepositMinor    int64
	PaymentInterval string
	Timezone        string
	Currency        string
}

func (r *RoomTransferRepository) getActiveContractInfo(ctx context.Context, propertyID, tenantID uuid.UUID, contractID *uuid.UUID) (*contractRoomInfo, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, u.name, u.email, COALESCE(u.phone, ''),
			c.room_id, COALESCE(rm.room_number, ''),
			ROUND(COALESCE(rm.price_per_month, c.monthly_rent))::bigint,
			c.start_date, c.end_date, c.monthly_rent,
			ROUND(COALESCE(c.deposit, 0))::bigint,
			COALESCE(c.payment_interval, 'monthly'),
			COALESCE(bp.timezone, p.timezone),
			p.currency
		FROM contracts c
		JOIN properties p ON p.id = c.property_id
		LEFT JOIN billing_policies bp ON bp.property_id = c.property_id
		JOIN users u ON u.id = c.user_id
		LEFT JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		WHERE c.property_id = $1 AND c.status = 'active'
	`
	args := []any{propertyID}
	if contractID != nil && *contractID != uuid.Nil {
		query += ` AND c.id = $2`
		args = append(args, *contractID)
	} else {
		query += ` AND c.user_id = $2 ORDER BY c.created_at DESC LIMIT 1`
		args = append(args, tenantID)
	}

	var info contractRoomInfo
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&info.ContractID, &info.PropertyID, &info.TenantID, &info.TenantName, &info.TenantEmail, &info.TenantPhone,
		&info.RoomID, &info.RoomNumber, &info.RoomPriceMinor,
		&info.StartDate, &info.EndDate, &info.MonthlyRent,
		&info.DepositMinor, &info.PaymentInterval, &info.Timezone, &info.Currency,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNoContract
	}
	if err != nil {
		return nil, err
	}
	return &info, nil
}

type roomTargetInfo struct {
	ID              uuid.UUID
	RoomNumber      string
	Type            string
	PriceMinor      int64
	DefaultDeposit  int64
	Status          string
}

func (r *RoomTransferRepository) getTargetRoomInfo(ctx context.Context, propertyID, roomID uuid.UUID) (*roomTargetInfo, error) {
	var target roomTargetInfo
	err := r.db.QueryRow(ctx, `
		SELECT id, room_number, type, ROUND(price_per_month)::bigint, ROUND(price_per_month)::bigint, status
		FROM rooms
		WHERE property_id = $1 AND id = $2
	`, propertyID, roomID).Scan(&target.ID, &target.RoomNumber, &target.Type, &target.PriceMinor, &target.DefaultDeposit, &target.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("kamar target tidak ditemukan")
	}
	if err != nil {
		return nil, err
	}
	return &target, nil
}

func (r *RoomTransferRepository) getTenantBalances(ctx context.Context, propertyID, tenantID uuid.UUID) (creditBalance int64, outstandingInvoices int64, err error) {
	// Credit balance: last balance from tenant_credits
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(balance_after_minor, 0)
		FROM tenant_credits
		WHERE property_id = $1 AND tenant_id = $2
		ORDER BY created_at DESC LIMIT 1
	`, propertyID, tenantID).Scan(&creditBalance)

	// Outstanding invoices: sum of unpaid invoice totals minus allocations/credits
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(
			i.total_minor - (
				COALESCE((SELECT SUM(amount_minor) FROM invoice_allocations ia WHERE ia.invoice_id = i.id AND ia.status = 'valid'), 0) +
				COALESCE((SELECT SUM(amount_minor) FROM invoice_credit_applications ic WHERE ic.invoice_id = i.id AND ic.status = 'valid'), 0)
			)
		), 0)
		FROM invoices i
		WHERE i.property_id = $1 AND i.tenant_id = $2 AND i.status IN ('issued', 'partially_paid', 'overdue')
	`, propertyID, tenantID).Scan(&outstandingInvoices)

	if outstandingInvoices < 0 {
		outstandingInvoices = 0
	}
	return creditBalance, outstandingInvoices, nil
}

func (r *RoomTransferRepository) PreviewTransfer(
	ctx context.Context,
	propertyID uuid.UUID,
	contractID *uuid.UUID,
	tenantID *uuid.UUID,
	toRoomID uuid.UUID,
	effectiveDateStr string,
	moveFeeMinor int64,
) (*model.TransferCalculation, error) {
	effectiveDate, err := time.Parse("2006-01-02", strings.TrimSpace(effectiveDateStr))
	if err != nil {
		return nil, fmt.Errorf("format tanggal efektif tidak valid, gunakan YYYY-MM-DD")
	}

	var targetTenantID uuid.UUID
	if tenantID != nil {
		targetTenantID = *tenantID
	}

	contractInfo, err := r.getActiveContractInfo(ctx, propertyID, targetTenantID, contractID)
	if err != nil {
		return nil, err
	}

	if contractInfo.RoomID == toRoomID {
		return nil, ErrRoomTransferSameRoom
	}

	if effectiveDate.Before(contractInfo.StartDate) || effectiveDate.After(contractInfo.EndDate) {
		return nil, ErrRoomTransferInvalidDates
	}

	targetRoom, err := r.getTargetRoomInfo(ctx, propertyID, toRoomID)
	if err != nil {
		return nil, err
	}

	// Check occupancy collision for target room
	var occupied bool
	err = r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM occupancy_periods
			WHERE property_id = $1 AND room_id = $2 AND closed_at IS NULL
			  AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
			  AND contract_id <> $5
		)
	`, propertyID, toRoomID, effectiveDate, contractInfo.EndDate, contractInfo.ContractID).Scan(&occupied)
	if err != nil {
		return nil, err
	}
	if occupied {
		return nil, ErrRoomTransferUnavailable
	}

	creditBal, outstandingInv, _ := r.getTenantBalances(ctx, propertyID, contractInfo.TenantID)

	calc := billing.CalculateRoomTransfer(billing.TransferCalcInput{
		ContractID:               contractInfo.ContractID,
		FromRoomID:               contractInfo.RoomID,
		FromRoomNumber:           contractInfo.RoomNumber,
		FromRoomPriceMinor:       contractInfo.RoomPriceMinor,
		ToRoomID:                 targetRoom.ID,
		ToRoomNumber:             targetRoom.RoomNumber,
		ToRoomPriceMinor:         targetRoom.PriceMinor,
		FromDepositMinor:         contractInfo.DepositMinor,
		ToDepositMinor:           targetRoom.DefaultDeposit,
		MoveFeeMinor:             moveFeeMinor,
		EffectiveDate:            effectiveDate,
		ContractEndDate:          contractInfo.EndDate,
		TenantCreditBalanceMinor: creditBal,
		OutstandingInvoicesMinor: outstandingInv,
		Currency:                 contractInfo.Currency,
		Timezone:                 contractInfo.Timezone,
	})

	return &calc, nil
}

func (r *RoomTransferRepository) CreateTransferRequest(
	ctx context.Context,
	propertyID, actorID uuid.UUID,
	req model.CreateTransferRequest,
) (*model.RoomTransfer, error) {
	effectiveDate, err := time.Parse("2006-01-02", strings.TrimSpace(req.EffectiveDate))
	if err != nil {
		return nil, fmt.Errorf("format tanggal efektif tidak valid, gunakan YYYY-MM-DD")
	}

	var targetTenantID uuid.UUID
	if req.TenantID != nil && *req.TenantID != uuid.Nil {
		targetTenantID = *req.TenantID
	} else {
		targetTenantID = actorID
	}

	contractInfo, err := r.getActiveContractInfo(ctx, propertyID, targetTenantID, req.ContractID)
	if err != nil {
		return nil, err
	}

	if contractInfo.RoomID == req.ToRoomID {
		return nil, ErrRoomTransferSameRoom
	}

	if effectiveDate.Before(contractInfo.StartDate) || effectiveDate.After(contractInfo.EndDate) {
		return nil, ErrRoomTransferInvalidDates
	}

	targetRoom, err := r.getTargetRoomInfo(ctx, propertyID, req.ToRoomID)
	if err != nil {
		return nil, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Row-level lock on the target room
	var lockedID uuid.UUID
	err = tx.QueryRow(ctx, `SELECT id FROM rooms WHERE property_id = $1 AND id = $2 FOR UPDATE`, propertyID, req.ToRoomID).Scan(&lockedID)
	if err != nil {
		return nil, fmt.Errorf("gagal mengunci kamar target: %w", err)
	}

	// Check if target room is occupied during requested period
	var occupied bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM occupancy_periods
			WHERE property_id = $1 AND room_id = $2 AND closed_at IS NULL
			  AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
			  AND contract_id <> $5
		)
	`, propertyID, req.ToRoomID, effectiveDate, contractInfo.EndDate, contractInfo.ContractID).Scan(&occupied)
	if err != nil {
		return nil, err
	}
	if occupied {
		return nil, ErrRoomTransferUnavailable
	}

	creditBal, outstandingInv, _ := r.getTenantBalances(ctx, propertyID, contractInfo.TenantID)

	calc := billing.CalculateRoomTransfer(billing.TransferCalcInput{
		ContractID:               contractInfo.ContractID,
		FromRoomID:               contractInfo.RoomID,
		FromRoomNumber:           contractInfo.RoomNumber,
		FromRoomPriceMinor:       contractInfo.RoomPriceMinor,
		ToRoomID:                 targetRoom.ID,
		ToRoomNumber:             targetRoom.RoomNumber,
		ToRoomPriceMinor:         targetRoom.PriceMinor,
		FromDepositMinor:         contractInfo.DepositMinor,
		ToDepositMinor:           targetRoom.DefaultDeposit,
		MoveFeeMinor:             req.MoveFeeMinor,
		EffectiveDate:            effectiveDate,
		ContractEndDate:          contractInfo.EndDate,
		TenantCreditBalanceMinor: creditBal,
		OutstandingInvoicesMinor: outstandingInv,
		Currency:                 contractInfo.Currency,
		Timezone:                 contractInfo.Timezone,
	})

	calcJSON, err := json.Marshal(calc)
	if err != nil {
		return nil, err
	}

	transferID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO room_transfers (
			id, property_id, contract_id, tenant_id, from_room_id, to_room_id,
			requested_by, effective_date, target_end_date, status, reason,
			calculation_preview, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, 'pending', $10,
			$11, NOW(), NOW()
		)
	`, transferID, propertyID, contractInfo.ContractID, contractInfo.TenantID, contractInfo.RoomID, req.ToRoomID,
		actorID, effectiveDate, contractInfo.EndDate, strings.TrimSpace(req.Reason), calcJSON)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23P01" { // exclusion_violation
			return nil, ErrRoomTransferConflict
		}
		return nil, err
	}

	// Notification Outbox event: room_transfer_requested
	outboxPayload, _ := json.Marshal(map[string]any{
		"transfer_id":    transferID,
		"property_id":    propertyID,
		"contract_id":    contractInfo.ContractID,
		"tenant_id":      contractInfo.TenantID,
		"tenant_name":    contractInfo.TenantName,
		"from_room_id":   contractInfo.RoomID,
		"from_room":      contractInfo.RoomNumber,
		"to_room_id":     req.ToRoomID,
		"to_room":        targetRoom.RoomNumber,
		"effective_date": effectiveDate.Format("2006-01-02"),
		"status":         "pending",
		"requested_by":   actorID,
		"reason":         strings.TrimSpace(req.Reason),
		"calculation":    calc,
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'room_transfer_requested', 'room_transfer', $2, $3)
	`, propertyID, transferID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTransfer(ctx, propertyID, transferID)
}

func (r *RoomTransferRepository) ApproveTransfer(
	ctx context.Context,
	propertyID, actorID, transferID uuid.UUID,
) (*model.RoomTransfer, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var currentStatus string
	var toRoomID uuid.UUID
	var effectiveDate, targetEndDate time.Time
	var contractID, tenantID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT status, to_room_id, effective_date, target_end_date, contract_id, tenant_id
		FROM room_transfers
		WHERE property_id = $1 AND id = $2
		FOR UPDATE
	`, propertyID, transferID).Scan(&currentStatus, &toRoomID, &effectiveDate, &targetEndDate, &contractID, &tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	if currentStatus != string(model.RoomTransferPending) {
		return nil, fmt.Errorf("%w: hanya pengajuan dengan status 'pending' yang dapat disetujui", ErrRoomTransferInvalidState)
	}

	// Verify target room is still available
	var occupied bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM occupancy_periods
			WHERE property_id = $1 AND room_id = $2 AND closed_at IS NULL
			  AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
			  AND contract_id <> $5
		)
	`, propertyID, toRoomID, effectiveDate, targetEndDate, contractID).Scan(&occupied)
	if err != nil {
		return nil, err
	}
	if occupied {
		return nil, ErrRoomTransferUnavailable
	}

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE room_transfers
		SET status = 'approved', approved_by = $1, approved_at = $2, updated_at = $2
		WHERE property_id = $3 AND id = $4
	`, actorID, now, propertyID, transferID)
	if err != nil {
		return nil, err
	}

	outboxPayload, _ := json.Marshal(map[string]any{
		"transfer_id":    transferID,
		"property_id":    propertyID,
		"contract_id":    contractID,
		"tenant_id":      tenantID,
		"approved_by":    actorID,
		"approved_at":    now.Format(time.RFC3339),
		"effective_date": effectiveDate.Format("2006-01-02"),
		"status":         "approved",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'room_transfer_approved', 'room_transfer', $2, $3)
	`, propertyID, transferID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTransfer(ctx, propertyID, transferID)
}

func (r *RoomTransferRepository) RejectTransfer(
	ctx context.Context,
	propertyID, actorID, transferID uuid.UUID,
	reason string,
) (*model.RoomTransfer, error) {
	cleanReason := strings.TrimSpace(reason)
	if cleanReason == "" {
		return nil, fmt.Errorf("alasan penolakan wajib diisi")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var currentStatus string
	var contractID, tenantID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT status, contract_id, tenant_id
		FROM room_transfers
		WHERE property_id = $1 AND id = $2
		FOR UPDATE
	`, propertyID, transferID).Scan(&currentStatus, &contractID, &tenantID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	if currentStatus != string(model.RoomTransferPending) && currentStatus != string(model.RoomTransferApproved) {
		return nil, fmt.Errorf("%w: status %s tidak dapat ditolak", ErrRoomTransferInvalidState, currentStatus)
	}

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE room_transfers
		SET status = 'rejected', rejection_reason = $1, approved_by = $2, approved_at = $3, updated_at = $3
		WHERE property_id = $4 AND id = $5
	`, cleanReason, actorID, now, propertyID, transferID)
	if err != nil {
		return nil, err
	}

	outboxPayload, _ := json.Marshal(map[string]any{
		"transfer_id":      transferID,
		"property_id":      propertyID,
		"contract_id":      contractID,
		"tenant_id":        tenantID,
		"rejected_by":      actorID,
		"rejection_reason": cleanReason,
		"status":           "rejected",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'room_transfer_rejected', 'room_transfer', $2, $3)
	`, propertyID, transferID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTransfer(ctx, propertyID, transferID)
}

func (r *RoomTransferRepository) CancelTransfer(
	ctx context.Context,
	propertyID, actorID, transferID uuid.UUID,
	isStaff bool,
) (*model.RoomTransfer, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var currentStatus string
	var tenantID, contractID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT status, tenant_id, contract_id
		FROM room_transfers
		WHERE property_id = $1 AND id = $2
		FOR UPDATE
	`, propertyID, transferID).Scan(&currentStatus, &tenantID, &contractID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	if !isStaff && tenantID != actorID {
		return nil, ErrRoomTransferUnauthorized
	}

	if currentStatus != string(model.RoomTransferPending) && currentStatus != string(model.RoomTransferApproved) {
		return nil, fmt.Errorf("%w: status %s tidak dapat dibatalkan", ErrRoomTransferInvalidState, currentStatus)
	}

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE room_transfers
		SET status = 'cancelled', updated_at = $1
		WHERE property_id = $2 AND id = $3
	`, now, propertyID, transferID)
	if err != nil {
		return nil, err
	}

	outboxPayload, _ := json.Marshal(map[string]any{
		"transfer_id":  transferID,
		"property_id":  propertyID,
		"contract_id":  contractID,
		"tenant_id":    tenantID,
		"cancelled_by": actorID,
		"status":       "cancelled",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'room_transfer_cancelled', 'room_transfer', $2, $3)
	`, propertyID, transferID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetTransfer(ctx, propertyID, transferID)
}

// ExecuteTransfer atomically closes the old room occupancy, creates the new occupancy,
// updates contract and versioned history, generates adjustment invoice, updates room statuses,
// and emits notification outbox events. If any step fails, the entire transaction rolls back cleanly.
func (r *RoomTransferRepository) ExecuteTransfer(
	ctx context.Context,
	propertyID, actorID, transferID uuid.UUID,
) (*model.RoomTransfer, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var (
		currentStatus                       string
		contractID, tenantID                uuid.UUID
		fromRoomID, toRoomID                uuid.UUID
		effectiveDate, targetEndDate        time.Time
		previewJSON                         []byte
	)

	err = tx.QueryRow(ctx, `
		SELECT status, contract_id, tenant_id, from_room_id, to_room_id, effective_date, target_end_date, calculation_preview
		FROM room_transfers
		WHERE property_id = $1 AND id = $2
		FOR UPDATE
	`, propertyID, transferID).Scan(
		&currentStatus, &contractID, &tenantID, &fromRoomID, &toRoomID, &effectiveDate, &targetEndDate, &previewJSON,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	if currentStatus != string(model.RoomTransferApproved) && currentStatus != string(model.RoomTransferPending) {
		return nil, fmt.Errorf("%w: status %s tidak dapat dieksekusi", ErrRoomTransferInvalidState, currentStatus)
	}

	// 1. Lock rooms
	var lock1, lock2 uuid.UUID
	_ = tx.QueryRow(ctx, `SELECT id FROM rooms WHERE property_id = $1 AND id = $2 FOR UPDATE`, propertyID, fromRoomID).Scan(&lock1)
	_ = tx.QueryRow(ctx, `SELECT id FROM rooms WHERE property_id = $1 AND id = $2 FOR UPDATE`, propertyID, toRoomID).Scan(&lock2)

	// 2. Fetch contract & target room details
	var (
		contractStartDate, contractEndDate time.Time
		contractMonthlyRent, deposit       float64
		contractStatus                     string
		currentVersionID                   *uuid.UUID
		paymentInterval                    string
		currency                           string
	)
	err = tx.QueryRow(ctx, `
		SELECT c.start_date, c.end_date, c.monthly_rent, COALESCE(c.deposit, 0), c.status, c.current_version_id,
		       COALESCE(c.payment_interval, 'monthly'), p.currency
		FROM contracts c
		JOIN properties p ON p.id = c.property_id
		WHERE c.property_id = $1 AND c.id = $2
		FOR UPDATE
	`, propertyID, contractID).Scan(
		&contractStartDate, &contractEndDate, &contractMonthlyRent, &deposit, &contractStatus, &currentVersionID,
		&paymentInterval, &currency,
	)
	if err != nil {
		return nil, fmt.Errorf("kontrak tidak ditemukan: %w", err)
	}
	if contractStatus != "active" {
		return nil, fmt.Errorf("kontrak sudah tidak aktif (%s)", contractStatus)
	}

	var targetRoomNumber string
	var targetRoomPrice float64
	err = tx.QueryRow(ctx, `
		SELECT room_number, price_per_month FROM rooms WHERE property_id = $1 AND id = $2
	`, propertyID, toRoomID).Scan(&targetRoomNumber, &targetRoomPrice)
	if err != nil {
		return nil, fmt.Errorf("kamar target tidak ditemukan: %w", err)
	}

	var fromRoomNumber string
	_ = tx.QueryRow(ctx, `SELECT room_number FROM rooms WHERE property_id = $1 AND id = $2`, propertyID, fromRoomID).Scan(&fromRoomNumber)

	// 3. Verify target room is free from overlapping occupancy
	var targetOccupied bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM occupancy_periods
			WHERE property_id = $1 AND room_id = $2 AND closed_at IS NULL
			  AND daterange(start_date, end_date, '[]') && daterange($3::date, $4::date, '[]')
			  AND contract_id <> $5
		)
	`, propertyID, toRoomID, effectiveDate, contractEndDate, contractID).Scan(&targetOccupied)
	if err != nil {
		return nil, err
	}
	if targetOccupied {
		return nil, ErrRoomTransferUnavailable
	}

	now := time.Now()

	// 4. Close old occupancy period
	// Calculate end date for old room: day before effective date, or effectiveDate if start >= effectiveDate
	oldEnd := effectiveDate.AddDate(0, 0, -1)
	if oldEnd.Before(contractStartDate) {
		oldEnd = contractStartDate
	}

	_, err = tx.Exec(ctx, `
		UPDATE occupancy_periods
		SET end_date = LEAST(end_date, $1::date), closed_at = $2
		WHERE property_id = $3 AND contract_id = $4 AND room_id = $5 AND closed_at IS NULL
	`, oldEnd, now, propertyID, contractID, fromRoomID)
	if err != nil {
		return nil, fmt.Errorf("gagal menutup periode hunian lama: %w", err)
	}

	// 5. Open new occupancy period
	_, err = tx.Exec(ctx, `
		INSERT INTO occupancy_periods (
			property_id, contract_id, room_id, user_id, start_date, end_date, closed_at, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, NULL, $7
		)
	`, propertyID, contractID, toRoomID, tenantID, effectiveDate, contractEndDate, now)
	if err != nil {
		return nil, fmt.Errorf("gagal mencatat periode hunian baru: %w", err)
	}

	// 6. Update contract room_id and monthly_rent
	_, err = tx.Exec(ctx, `
		UPDATE contracts
		SET room_id = $1, monthly_rent = $2, updated_at = $3
		WHERE property_id = $4 AND id = $5
	`, toRoomID, targetRoomPrice, now, propertyID, contractID)
	if err != nil {
		return nil, fmt.Errorf("gagal memperbarui kontrak: %w", err)
	}

	// Create contract version snapshot
	var nextVer int
	_ = tx.QueryRow(ctx, `SELECT COALESCE(MAX(version_number), 0) + 1 FROM contract_versions WHERE contract_id = $1`, contractID).Scan(&nextVer)

	snapshotJSON, _ := json.Marshal(map[string]any{
		"contract_id":      contractID,
		"property_id":      propertyID,
		"room_id":          toRoomID,
		"from_room_id":     fromRoomID,
		"to_room_number":   targetRoomNumber,
		"from_room_number": fromRoomNumber,
		"monthly_rent":     targetRoomPrice,
		"start_date":       contractStartDate.Format("2006-01-02"),
		"end_date":         contractEndDate.Format("2006-01-02"),
		"effective_date":   effectiveDate.Format("2006-01-02"),
		"transfer_id":      transferID,
		"reason":           "Pindah kamar ke " + targetRoomNumber,
	})

	var newVerID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO contract_versions (property_id, contract_id, version_number, snapshot, reason, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, propertyID, contractID, nextVer, snapshotJSON, "Pindah kamar ke "+targetRoomNumber, actorID, now).Scan(&newVerID)
	if err != nil {
		return nil, fmt.Errorf("gagal membuat versi kontrak baru: %w", err)
	}

	_, _ = tx.Exec(ctx, `UPDATE contracts SET current_version_id = $1 WHERE property_id = $2 AND id = $3`, newVerID, propertyID, contractID)

	_, _ = tx.Exec(ctx, `
		INSERT INTO contract_events (property_id, contract_id, version_id, event_type, from_status, to_status, reason, metadata, actor_id, created_at)
		VALUES ($1, $2, $3, 'room_transferred', 'active', 'active', $4, $5, $6, $7)
	`, propertyID, contractID, newVerID, "Perpindahan kamar ke "+targetRoomNumber, snapshotJSON, actorID, now)

	// 7. Update Room Statuses
	// If from_room has no remaining open occupancies, mark it available
	_, _ = tx.Exec(ctx, `
		UPDATE rooms SET status = 'available'
		WHERE property_id = $1 AND id = $2
		  AND NOT EXISTS (SELECT 1 FROM occupancy_periods WHERE property_id = $1 AND room_id = $2 AND closed_at IS NULL)
	`, propertyID, fromRoomID)

	// Target room is now occupied
	_, _ = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE property_id = $1 AND id = $2`, propertyID, toRoomID)

	// 8. Adjustment Invoice creation if NetTotalAdjustmentMinor != 0
	var calc model.TransferCalculation
	_ = json.Unmarshal(previewJSON, &calc)

	var adjustmentInvoiceID *uuid.UUID
	if calc.NetTotalAdjustmentMinor != 0 {
		adjID := uuid.New()
		period := time.Date(effectiveDate.Year(), effectiveDate.Month(), 1, 0, 0, 0, 0, time.UTC)
		number := fmt.Sprintf("ADJ-TRF-%s-%s", period.Format("200601"), strings.ToUpper(strings.ReplaceAll(transferID.String(), "-", ""))[:8])
		key := fmt.Sprintf("room_transfer_adj:%s", transferID.String())

		dueAt := now.AddDate(0, 0, 3) // 3 days grace for transfer adjustment

		invoiceSnapshotJSON, _ := json.Marshal(map[string]any{
			"transfer_id":                transferID,
			"contract_id":                contractID,
			"from_room_number":           fromRoomNumber,
			"to_room_number":             targetRoomNumber,
			"effective_date":             effectiveDate.Format("2006-01-02"),
			"rent_difference_minor":      calc.RentDifferenceMinor,
			"deposit_difference_minor":   calc.DepositDifferenceMinor,
			"move_fee_minor":             calc.MoveFeeMinor,
			"credit_applied_minor":       calc.CreditAppliedMinor,
			"net_total_adjustment_minor": calc.NetTotalAdjustmentMinor,
		})

		_, err = tx.Exec(ctx, `
			INSERT INTO invoices (
				id, property_id, contract_id, tenant_id, invoice_number, billing_period,
				invoice_type, status, currency, due_at, calculation_snapshot, idempotency_key,
				issued_at, created_by
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				'adjustment', 'issued', $7, $8, $9, $10,
				$11, $12
			)
		`, adjID, propertyID, contractID, tenantID, number, period, currency, dueAt, invoiceSnapshotJSON, key, now, actorID)
		if err != nil {
			return nil, fmt.Errorf("gagal membuat invoice adjustment: %w", err)
		}

		// Line items
		itemDesc := fmt.Sprintf("Penyesuaian pindah kamar (%s -> %s)", fromRoomNumber, targetRoomNumber)
		if calc.RentDifferenceMinor != 0 {
			rentDesc := fmt.Sprintf("Selisih prorata sewa kamar %s -> %s", fromRoomNumber, targetRoomNumber)
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_items (
					property_id, invoice_id, item_type, description, unit_amount_minor, amount_minor, reason, metadata, created_by
				) VALUES (
					$1, $2, 'adjustment', $3, $4, $4, $5, $6, $7
				)
			`, propertyID, adjID, rentDesc, calc.RentDifferenceMinor, "Prorata sewa pindah kamar", invoiceSnapshotJSON, actorID)
			if err != nil {
				return nil, fmt.Errorf("gagal membuat invoice item sewa: %w", err)
			}
		}

		if calc.MoveFeeMinor > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_items (
					property_id, invoice_id, item_type, description, unit_amount_minor, amount_minor, reason, metadata, created_by
				) VALUES (
					$1, $2, 'one_off', 'Biaya administrasi pindah kamar', $3, $3, 'Biaya administrasi', $4, $5
				)
			`, propertyID, adjID, calc.MoveFeeMinor, invoiceSnapshotJSON, actorID)
			if err != nil {
				return nil, fmt.Errorf("gagal membuat invoice item move fee: %w", err)
			}
		}

		if calc.DepositDifferenceMinor != 0 {
			depDesc := fmt.Sprintf("Selisih deposit kamar %s -> %s", fromRoomNumber, targetRoomNumber)
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_items (
					property_id, invoice_id, item_type, description, unit_amount_minor, amount_minor, reason, metadata, created_by
				) VALUES (
					$1, $2, 'adjustment', $3, $4, $4, $5, $6, $7
				)
			`, propertyID, adjID, depDesc, calc.DepositDifferenceMinor, "Penyesuaian deposit", invoiceSnapshotJSON, actorID)
			if err != nil {
				return nil, fmt.Errorf("gagal membuat invoice item deposit: %w", err)
			}
		}

		if calc.CreditAppliedMinor > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_items (
					property_id, invoice_id, item_type, description, unit_amount_minor, amount_minor, reason, metadata, created_by
				) VALUES (
					$1, $2, 'credit', 'Penggunaan saldo kredit tenant', -$3, -$3, 'Kredit diterapkan', $4, $5
				)
			`, propertyID, adjID, calc.CreditAppliedMinor, invoiceSnapshotJSON, actorID)
			if err != nil {
				return nil, fmt.Errorf("gagal membuat invoice item kredit: %w", err)
			}
		}

		_, _ = tx.Exec(ctx, `
			INSERT INTO invoice_events (property_id, invoice_id, event_type, reason, metadata, actor_id, created_at)
			VALUES ($1, $2, 'issued', $3, $4, $5, $6)
		`, propertyID, adjID, itemDesc, invoiceSnapshotJSON, actorID, now)

		adjustmentInvoiceID = &adjID
	}

	// 9. Mark room transfer completed
	_, err = tx.Exec(ctx, `
		UPDATE room_transfers
		SET status = 'completed', completed_at = $1, adjustment_invoice_id = $2, updated_at = $1
		WHERE property_id = $3 AND id = $4
	`, now, adjustmentInvoiceID, propertyID, transferID)
	if err != nil {
		return nil, fmt.Errorf("gagal memperbarui status pengajuan: %w", err)
	}

	// 10. Notification Outbox event: room_transfer_completed
	outboxPayload, _ := json.Marshal(map[string]any{
		"transfer_id":           transferID,
		"property_id":           propertyID,
		"contract_id":           contractID,
		"tenant_id":             tenantID,
		"from_room_id":          fromRoomID,
		"from_room_number":      fromRoomNumber,
		"to_room_id":            toRoomID,
		"to_room_number":        targetRoomNumber,
		"effective_date":        effectiveDate.Format("2006-01-02"),
		"status":                "completed",
		"adjustment_invoice_id": adjustmentInvoiceID,
		"completed_by":          actorID,
		"completed_at":          now.Format(time.RFC3339),
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'room_transfer_completed', 'room_transfer', $2, $3)
	`, propertyID, transferID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("transaksi gagal: %w", err)
	}

	return r.GetTransfer(ctx, propertyID, transferID)
}

func (r *RoomTransferRepository) GetTransfer(ctx context.Context, propertyID, transferID uuid.UUID) (*model.RoomTransfer, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			rt.id, rt.property_id, rt.contract_id, rt.tenant_id, rt.from_room_id, rt.to_room_id,
			rt.requested_by, rt.effective_date, rt.target_end_date, rt.status, rt.reason,
			rt.rejection_reason, rt.approved_by, rt.approved_at, rt.completed_at,
			rt.calculation_preview, rt.adjustment_invoice_id, rt.created_at, rt.updated_at,
			u.name AS tenant_name, u.email AS tenant_email, COALESCE(u.phone, '') AS tenant_phone,
			COALESCE(rf.room_number, '') AS from_room_number,
			COALESCE(rtg.room_number, '') AS to_room_number,
			COALESCE(req_u.name, '') AS requested_by_name,
			COALESCE(app_u.name, '') AS approved_by_name
		FROM room_transfers rt
		JOIN users u ON u.id = rt.tenant_id
		LEFT JOIN rooms rf ON rf.id = rt.from_room_id AND rf.property_id = rt.property_id
		LEFT JOIN rooms rtg ON rtg.id = rt.to_room_id AND rtg.property_id = rt.property_id
		LEFT JOIN users req_u ON req_u.id = rt.requested_by
		LEFT JOIN users app_u ON app_u.id = rt.approved_by
		WHERE rt.property_id = $1 AND rt.id = $2
	`, propertyID, transferID)

	var t model.RoomTransfer
	var calcJSON []byte
	err := row.Scan(
		&t.ID, &t.PropertyID, &t.ContractID, &t.TenantID, &t.FromRoomID, &t.ToRoomID,
		&t.RequestedBy, &t.EffectiveDate, &t.TargetEndDate, &t.Status, &t.Reason,
		&t.RejectionReason, &t.ApprovedBy, &t.ApprovedAt, &t.CompletedAt,
		&calcJSON, &t.AdjustmentInvoiceID, &t.CreatedAt, &t.UpdatedAt,
		&t.TenantName, &t.TenantEmail, &t.TenantPhone,
		&t.FromRoomNumber, &t.ToRoomNumber,
		&t.RequestedByName, &t.ApprovedByName,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRoomTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	_ = json.Unmarshal(calcJSON, &t.CalculationPreview)
	return &t, nil
}

func (r *RoomTransferRepository) ListTransfers(ctx context.Context, propertyID uuid.UUID, status string) ([]model.RoomTransfer, error) {
	query := `
		SELECT
			rt.id, rt.property_id, rt.contract_id, rt.tenant_id, rt.from_room_id, rt.to_room_id,
			rt.requested_by, rt.effective_date, rt.target_end_date, rt.status, rt.reason,
			rt.rejection_reason, rt.approved_by, rt.approved_at, rt.completed_at,
			rt.calculation_preview, rt.adjustment_invoice_id, rt.created_at, rt.updated_at,
			u.name AS tenant_name, u.email AS tenant_email, COALESCE(u.phone, '') AS tenant_phone,
			COALESCE(rf.room_number, '') AS from_room_number,
			COALESCE(rtg.room_number, '') AS to_room_number,
			COALESCE(req_u.name, '') AS requested_by_name,
			COALESCE(app_u.name, '') AS approved_by_name
		FROM room_transfers rt
		JOIN users u ON u.id = rt.tenant_id
		LEFT JOIN rooms rf ON rf.id = rt.from_room_id AND rf.property_id = rt.property_id
		LEFT JOIN rooms rtg ON rtg.id = rt.to_room_id AND rtg.property_id = rt.property_id
		LEFT JOIN users req_u ON req_u.id = rt.requested_by
		LEFT JOIN users app_u ON app_u.id = rt.approved_by
		WHERE rt.property_id = $1
	`
	args := []any{propertyID}
	if strings.TrimSpace(status) != "" {
		query += ` AND rt.status = $2`
		args = append(args, strings.TrimSpace(status))
	}
	query += ` ORDER BY rt.created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.RoomTransfer
	for rows.Next() {
		var t model.RoomTransfer
		var calcJSON []byte
		err := rows.Scan(
			&t.ID, &t.PropertyID, &t.ContractID, &t.TenantID, &t.FromRoomID, &t.ToRoomID,
			&t.RequestedBy, &t.EffectiveDate, &t.TargetEndDate, &t.Status, &t.Reason,
			&t.RejectionReason, &t.ApprovedBy, &t.ApprovedAt, &t.CompletedAt,
			&calcJSON, &t.AdjustmentInvoiceID, &t.CreatedAt, &t.UpdatedAt,
			&t.TenantName, &t.TenantEmail, &t.TenantPhone,
			&t.FromRoomNumber, &t.ToRoomNumber,
			&t.RequestedByName, &t.ApprovedByName,
		)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(calcJSON, &t.CalculationPreview)
		list = append(list, t)
	}
	return list, rows.Err()
}

func (r *RoomTransferRepository) ListTransfersForTenant(ctx context.Context, propertyID, tenantID uuid.UUID) ([]model.RoomTransfer, error) {
	query := `
		SELECT
			rt.id, rt.property_id, rt.contract_id, rt.tenant_id, rt.from_room_id, rt.to_room_id,
			rt.requested_by, rt.effective_date, rt.target_end_date, rt.status, rt.reason,
			rt.rejection_reason, rt.approved_by, rt.approved_at, rt.completed_at,
			rt.calculation_preview, rt.adjustment_invoice_id, rt.created_at, rt.updated_at,
			u.name AS tenant_name, u.email AS tenant_email, COALESCE(u.phone, '') AS tenant_phone,
			COALESCE(rf.room_number, '') AS from_room_number,
			COALESCE(rtg.room_number, '') AS to_room_number,
			COALESCE(req_u.name, '') AS requested_by_name,
			COALESCE(app_u.name, '') AS approved_by_name
		FROM room_transfers rt
		JOIN users u ON u.id = rt.tenant_id
		LEFT JOIN rooms rf ON rf.id = rt.from_room_id AND rf.property_id = rt.property_id
		LEFT JOIN rooms rtg ON rtg.id = rt.to_room_id AND rtg.property_id = rt.property_id
		LEFT JOIN users req_u ON req_u.id = rt.requested_by
		LEFT JOIN users app_u ON app_u.id = rt.approved_by
		WHERE rt.property_id = $1 AND rt.tenant_id = $2
		ORDER BY rt.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, propertyID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.RoomTransfer
	for rows.Next() {
		var t model.RoomTransfer
		var calcJSON []byte
		err := rows.Scan(
			&t.ID, &t.PropertyID, &t.ContractID, &t.TenantID, &t.FromRoomID, &t.ToRoomID,
			&t.RequestedBy, &t.EffectiveDate, &t.TargetEndDate, &t.Status, &t.Reason,
			&t.RejectionReason, &t.ApprovedBy, &t.ApprovedAt, &t.CompletedAt,
			&calcJSON, &t.AdjustmentInvoiceID, &t.CreatedAt, &t.UpdatedAt,
			&t.TenantName, &t.TenantEmail, &t.TenantPhone,
			&t.FromRoomNumber, &t.ToRoomNumber,
			&t.RequestedByName, &t.ApprovedByName,
		)
		if err != nil {
			return nil, err
		}
		_ = json.Unmarshal(calcJSON, &t.CalculationPreview)
		list = append(list, t)
	}
	return list, rows.Err()
}

// GetTenantRoomHistory implements AC 2: Histori kamar tenant dapat dilihat berdasarkan rentang tanggal.
func (r *RoomTransferRepository) GetTenantRoomHistory(
	ctx context.Context,
	propertyID, tenantID uuid.UUID,
	startDateFilter, endDateFilter *time.Time,
) ([]model.TenantRoomHistoryItem, error) {
	query := `
		SELECT
			op.id, op.property_id, op.contract_id, op.room_id,
			rm.room_number, rm.type, ROUND(rm.price_per_month)::bigint,
			op.user_id, u.name,
			op.start_date, op.end_date, op.closed_at,
			(op.closed_at IS NULL AND CURRENT_DATE >= op.start_date AND CURRENT_DATE <= op.end_date) AS is_current,
			rt.id AS transfer_id,
			COALESCE(rt.reason, '') AS transfer_reason,
			op.created_at
		FROM occupancy_periods op
		JOIN rooms rm ON rm.id = op.room_id AND rm.property_id = op.property_id
		JOIN users u ON u.id = op.user_id
		LEFT JOIN room_transfers rt ON rt.contract_id = op.contract_id AND rt.to_room_id = op.room_id AND rt.status = 'completed'
		WHERE op.property_id = $1 AND op.user_id = $2
	`
	args := []any{propertyID, tenantID}
	idx := 3

	if startDateFilter != nil && !startDateFilter.IsZero() {
		query += fmt.Sprintf(" AND op.end_date >= $%d::date", idx)
		args = append(args, *startDateFilter)
		idx++
	}
	if endDateFilter != nil && !endDateFilter.IsZero() {
		query += fmt.Sprintf(" AND op.start_date <= $%d::date", idx)
		args = append(args, *endDateFilter)
		idx++
	}

	query += ` ORDER BY op.start_date DESC, op.created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []model.TenantRoomHistoryItem
	for rows.Next() {
		var item model.TenantRoomHistoryItem
		err := rows.Scan(
			&item.ID, &item.PropertyID, &item.ContractID, &item.RoomID,
			&item.RoomNumber, &item.RoomType, &item.PricePerMonthMinor,
			&item.UserID, &item.TenantName,
			&item.StartDate, &item.EndDate, &item.ClosedAt,
			&item.IsCurrent,
			&item.TransferID, &item.TransferReason,
			&item.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		history = append(history, item)
	}
	return history, rows.Err()
}

// DelegateChangeRoom supports legacy endpoint /api/tenants/:id/change-room by executing
// an integrated transfer workflow instead of mutating the contract directly.
func (r *RoomTransferRepository) DelegateChangeRoom(
	ctx context.Context,
	propertyID, actorID, tenantID, toRoomID uuid.UUID,
	reason string,
) (*model.RoomTransfer, error) {
	if reason == "" {
		reason = "Pindah kamar oleh staf"
	}
	today := time.Now().Format("2006-01-02")

	// 1. Create transfer request
	req := model.CreateTransferRequest{
		TenantID:      &tenantID,
		ToRoomID:      toRoomID,
		EffectiveDate: today,
		Reason:        reason,
		MoveFeeMinor:  0,
	}

	transfer, err := r.CreateTransferRequest(ctx, propertyID, actorID, req)
	if err != nil {
		return nil, err
	}

	// 2. Approve transfer
	transfer, err = r.ApproveTransfer(ctx, propertyID, actorID, transfer.ID)
	if err != nil {
		return nil, err
	}

	// 3. Execute transfer
	return r.ExecuteTransfer(ctx, propertyID, actorID, transfer.ID)
}

// Suppress unused import errors if any
var _ = math.Abs
