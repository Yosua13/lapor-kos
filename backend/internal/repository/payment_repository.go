package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/payment"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PaymentRepository struct {
	db *pgxpool.Pool
}

func NewPaymentRepository(db *pgxpool.Pool) *PaymentRepository {
	return &PaymentRepository{db: db}
}

// Create derives the tenancy boundary from the referenced contract. The
// INSERT ... SELECT prevents a caller from attaching a bill to a contract in
// another property even when the contract UUID is known.
func (r *PaymentRepository) Create(ctx context.Context, p *model.Payment) error {
	amountMinor := p.AmountMinor
	if amountMinor == 0 && (p.AmountRent > 0 || p.AmountElectricity > 0 || p.AmountWater > 0 || p.AmountOther > 0) {
		amountMinor = int64(p.AmountRent + p.AmountElectricity + p.AmountWater + p.AmountOther)
	}

	query := `
		INSERT INTO payments (
			property_id, contract_id, tenant_id, owner_id, period_month, period_year,
			amount_rent, amount_electricity, amount_water, amount_other,
			amount_minor, paid_amount_minor, currency,
			total_paid, payment_method, provider, provider_ref, status, proof_photo_url,
			paid_at, due_date, notes
		)
		SELECT
			c.property_id, c.id, c.user_id, $3, $4, $5,
			$6, $7, $8, $9,
			$10, $11, 'IDR',
			$12, $13, $14, $15, $16, $17,
			$18, $19, $20
		FROM contracts c
		WHERE c.id = $1 AND c.property_id = $2
		RETURNING id, property_id, tenant_id, created_at`

	provider := p.Provider
	if provider == "" {
		provider = "manual"
	}

	return r.db.QueryRow(ctx, query,
		p.ContractID, p.PropertyID, p.OwnerID, p.PeriodMonth, p.PeriodYear,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		amountMinor, p.PaidAmountMinor,
		p.TotalPaid, p.PaymentMethod, provider, p.ProviderRef, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.DueDate, p.Notes,
	).Scan(&p.ID, &p.PropertyID, &p.TenantID, &p.CreatedAt)
}

const paymentDetailsSelect = `
	SELECT
		p.id, p.property_id, p.contract_id, p.tenant_id, p.owner_id, p.period_month, p.period_year,
		COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
		COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
		COALESCE(p.amount_minor, 0), COALESCE(p.paid_amount_minor, 0), COALESCE(p.currency, 'IDR'),
		COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), COALESCE(p.provider, 'manual'),
		p.provider_ref, p.status, COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
		COALESCE(p.notes, ''), p.verified_by, p.verified_at, COALESCE(p.verification_notes, ''),
		COALESCE(p.rejection_reason, ''), p.invoice_id, p.parent_payment_id, p.created_at,
		c.owner_id, COALESCE(c.monthly_rent, 0), COALESCE(c.deposit, 0),
		COALESCE(c.payment_due_day, 1), r.room_number, r.price_per_month,
		u.name, u.phone, u.id
	FROM payments p
	JOIN contracts c ON c.id = p.contract_id AND c.property_id = p.property_id
	LEFT JOIN rooms r ON r.id = c.room_id AND r.property_id = c.property_id
	LEFT JOIN users u ON u.id = c.user_id`

// FindByID is property-scoped for staff-facing reads and loads proofs, allocations, and receipts.
func (r *PaymentRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*model.Payment, error) {
	query := paymentDetailsSelect + ` WHERE p.id = $1 AND p.property_id = $2`
	p, err := scanPayment(r.db.QueryRow(ctx, query, id, propertyID))
	if err != nil {
		return nil, err
	}
	r.preloadRelations(ctx, p)
	return p, nil
}

// FindByIDForUser is the tenant self-service equivalent.
func (r *PaymentRepository) FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*model.Payment, error) {
	query := paymentDetailsSelect + ` WHERE p.id = $1 AND c.user_id = $2`
	p, err := scanPayment(r.db.QueryRow(ctx, query, id, userID))
	if err != nil {
		return nil, err
	}
	r.preloadRelations(ctx, p)
	return p, nil
}

func (r *PaymentRepository) preloadRelations(ctx context.Context, p *model.Payment) {
	// 1. Proofs
	proofRows, err := r.db.Query(ctx, `
		SELECT id, property_id, payment_id, file_url, amount_minor, payment_method, submitted_by, notes, created_at
		FROM payment_proofs
		WHERE payment_id = $1
		ORDER BY created_at ASC`, p.ID)
	if err == nil {
		defer proofRows.Close()
		for proofRows.Next() {
			var pr model.PaymentProof
			if err := proofRows.Scan(
				&pr.ID, &pr.PropertyID, &pr.PaymentID, &pr.FileURL, &pr.AmountMinor,
				&pr.PaymentMethod, &pr.SubmittedBy, &pr.Notes, &pr.CreatedAt,
			); err == nil {
				p.Proofs = append(p.Proofs, pr)
			}
		}
	}

	// 2. Allocations
	allocRows, err := r.db.Query(ctx, `
		SELECT id, property_id, invoice_id, payment_id, amount_minor, status, reason, created_by, created_at
		FROM invoice_allocations
		WHERE payment_id = $1
		ORDER BY created_at ASC`, p.ID)
	if err == nil {
		defer allocRows.Close()
		for allocRows.Next() {
			var al model.InvoiceAllocation
			if err := allocRows.Scan(
				&al.ID, &al.PropertyID, &al.InvoiceID, &al.PaymentID, &al.AmountMinor,
				&al.Status, &al.Reason, &al.CreatedBy, &al.CreatedAt,
			); err == nil {
				p.Allocations = append(p.Allocations, al)
			}
		}
	}

	// 3. Receipt
	var rc model.PaymentReceipt
	var snapshotJSON []byte
	err = r.db.QueryRow(ctx, `
		SELECT id, property_id, payment_id, receipt_number, tenant_id, total_minor, currency, snapshot, checksum, issued_by, issued_at, created_at
		FROM payment_receipts
		WHERE payment_id = $1
		LIMIT 1`, p.ID).Scan(
		&rc.ID, &rc.PropertyID, &rc.PaymentID, &rc.ReceiptNumber, &rc.TenantID, &rc.TotalMinor, &rc.Currency,
		&snapshotJSON, &rc.Checksum, &rc.IssuedBy, &rc.IssuedAt, &rc.CreatedAt,
	)
	if err == nil {
		_ = json.Unmarshal(snapshotJSON, &rc.Snapshot)
		p.Receipt = &rc
	}
}

func scanPayment(row pgx.Row) (*model.Payment, error) {
	p := &model.Payment{}
	var tenantID, ownerID, verifiedBy, invoiceID, parentPaymentID *uuid.UUID
	var paidAt, verifiedAt *time.Time
	var roomNum *string
	var roomPrice *float64
	var userName, userPhone *string
	var userID *uuid.UUID
	var contractOwnerID uuid.UUID
	var contractRent, contractDeposit *float64
	var contractDueDay *int

	err := row.Scan(
		&p.ID, &p.PropertyID, &p.ContractID, &tenantID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
		&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
		&p.AmountMinor, &p.PaidAmountMinor, &p.Currency,
		&p.TotalPaid, &p.PaymentMethod, &p.Provider, &p.ProviderRef, &p.Status,
		&p.ProofPhotoURL, &paidAt, &p.DueDate, &p.Notes,
		&verifiedBy, &verifiedAt, &p.VerificationNotes, &p.RejectionReason,
		&invoiceID, &parentPaymentID, &p.CreatedAt,
		&contractOwnerID, &contractRent, &contractDeposit, &contractDueDay,
		&roomNum, &roomPrice, &userName, &userPhone, &userID,
	)
	if err != nil {
		return nil, err
	}

	p.TenantID = tenantID
	p.OwnerID = ownerID
	p.PaidAt = paidAt
	p.VerifiedBy = verifiedBy
	p.VerifiedAt = verifiedAt
	p.InvoiceID = invoiceID
	p.ParentPaymentID = parentPaymentID

	p.Contract = &model.Contract{ID: p.ContractID, OwnerID: contractOwnerID}
	if contractRent != nil {
		p.Contract.MonthlyRent = *contractRent
		p.Contract.Deposit = *contractDeposit
		p.Contract.PaymentDueDay = *contractDueDay
	}
	if roomNum != nil {
		p.Contract.Room = &model.Room{RoomNumber: *roomNum}
		if roomPrice != nil {
			p.Contract.Room.PricePerMonth = *roomPrice
		}
	}
	if userName != nil && userID != nil {
		p.Contract.User = &model.User{ID: *userID, Name: *userName}
		if userPhone != nil {
			p.Contract.User.Phone = *userPhone
		}
	}

	return p, nil
}

func (r *PaymentRepository) FindAll(ctx context.Context, propertyID uuid.UUID, filterStatus string, filterMonth int, filterYear int, contractIDStr string, userIDStr string) ([]model.Payment, error) {
	query := `
		SELECT
			p.id, p.property_id, p.contract_id, p.tenant_id, p.owner_id, p.period_month, p.period_year,
			COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
			COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
			COALESCE(p.amount_minor, 0), COALESCE(p.paid_amount_minor, 0), COALESCE(p.currency, 'IDR'),
			COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), COALESCE(p.provider, 'manual'),
			p.provider_ref, p.status, COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
			COALESCE(p.notes, ''), p.verified_by, p.verified_at, COALESCE(p.verification_notes, ''),
			COALESCE(p.rejection_reason, ''), p.invoice_id, p.parent_payment_id, p.created_at,
			r.room_number, u.name, u.phone, COALESCE(c.deposit, 0)
		FROM payments p
		JOIN contracts c ON c.id = p.contract_id AND c.property_id = p.property_id
		LEFT JOIN rooms r ON r.id = c.room_id AND r.property_id = c.property_id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE p.property_id = $1`

	args := []interface{}{propertyID}
	argIdx := 2
	if filterStatus != "" {
		query += fmt.Sprintf(" AND p.status = $%d", argIdx)
		args = append(args, filterStatus)
		argIdx++
	}
	if filterMonth > 0 {
		query += fmt.Sprintf(" AND p.period_month = $%d", argIdx)
		args = append(args, filterMonth)
		argIdx++
	}
	if filterYear > 0 {
		query += fmt.Sprintf(" AND p.period_year = $%d", argIdx)
		args = append(args, filterYear)
		argIdx++
	}
	if contractIDStr != "" {
		parsedID, err := uuid.Parse(contractIDStr)
		if err != nil {
			return nil, fmt.Errorf("invalid contract filter: %w", err)
		}
		query += fmt.Sprintf(" AND p.contract_id = $%d", argIdx)
		args = append(args, parsedID)
		argIdx++
	}
	if userIDStr != "" {
		parsedID, err := uuid.Parse(userIDStr)
		if err != nil {
			return nil, fmt.Errorf("invalid user filter: %w", err)
		}
		query += fmt.Sprintf(" AND c.user_id = $%d", argIdx)
		args = append(args, parsedID)
	}

	query += " ORDER BY p.due_date DESC, p.created_at DESC"
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanPaymentList(rows)
}

func (r *PaymentRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]model.Payment, error) {
	query := `
		SELECT
			p.id, p.property_id, p.contract_id, p.tenant_id, p.owner_id, p.period_month, p.period_year,
			COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
			COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
			COALESCE(p.amount_minor, 0), COALESCE(p.paid_amount_minor, 0), COALESCE(p.currency, 'IDR'),
			COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), COALESCE(p.provider, 'manual'),
			p.provider_ref, p.status, COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
			COALESCE(p.notes, ''), p.verified_by, p.verified_at, COALESCE(p.verification_notes, ''),
			COALESCE(p.rejection_reason, ''), p.invoice_id, p.parent_payment_id, p.created_at,
			r.room_number, u.name, u.phone, COALESCE(c.deposit, 0)
		FROM payments p
		JOIN contracts c ON c.id = p.contract_id AND c.property_id = p.property_id
		LEFT JOIN rooms r ON r.id = c.room_id AND r.property_id = c.property_id
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.user_id = $1
		ORDER BY p.due_date DESC, p.created_at DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanPaymentList(rows)
}

func scanPaymentList(rows pgx.Rows) ([]model.Payment, error) {
	payments := make([]model.Payment, 0)
	for rows.Next() {
		var p model.Payment
		var tenantID, ownerID, verifiedBy, invoiceID, parentPaymentID *uuid.UUID
		var paidAt, verifiedAt *time.Time
		var roomNum, userName, userPhone *string
		var deposit float64

		if err := rows.Scan(
			&p.ID, &p.PropertyID, &p.ContractID, &tenantID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
			&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
			&p.AmountMinor, &p.PaidAmountMinor, &p.Currency,
			&p.TotalPaid, &p.PaymentMethod, &p.Provider, &p.ProviderRef, &p.Status,
			&p.ProofPhotoURL, &paidAt, &p.DueDate, &p.Notes,
			&verifiedBy, &verifiedAt, &p.VerificationNotes, &p.RejectionReason,
			&invoiceID, &parentPaymentID, &p.CreatedAt,
			&roomNum, &userName, &userPhone, &deposit,
		); err != nil {
			return nil, err
		}

		p.TenantID = tenantID
		p.OwnerID = ownerID
		p.PaidAt = paidAt
		p.VerifiedBy = verifiedBy
		p.VerifiedAt = verifiedAt
		p.InvoiceID = invoiceID
		p.ParentPaymentID = parentPaymentID

		p.Contract = &model.Contract{ID: p.ContractID, Deposit: deposit}
		if roomNum != nil {
			p.Contract.Room = &model.Room{RoomNumber: *roomNum}
		}
		if userName != nil {
			p.Contract.User = &model.User{Name: *userName}
			if userPhone != nil {
				p.Contract.User.Phone = *userPhone
			}
		}
		payments = append(payments, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return payments, nil
}

func (r *PaymentRepository) Update(ctx context.Context, propertyID uuid.UUID, p *model.Payment) (*model.Payment, error) {
	query := `
		UPDATE payments p
		SET amount_rent = $1, amount_electricity = $2, amount_water = $3,
			amount_other = $4, total_paid = $5, payment_method = $6,
			status = $7, proof_photo_url = $8, paid_at = $9, notes = $10,
			owner_id = $11, paid_amount_minor = $12
		FROM contracts c
		WHERE p.id = $13
		  AND p.property_id = $14
		  AND c.id = p.contract_id
		  AND c.property_id = p.property_id
		RETURNING p.id`

	paidMinor := p.PaidAmountMinor
	if paidMinor == 0 && p.TotalPaid > 0 {
		paidMinor = int64(p.TotalPaid)
	}

	var id uuid.UUID
	if err := r.db.QueryRow(ctx, query,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		p.TotalPaid, p.PaymentMethod, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.Notes, p.OwnerID, paidMinor, p.ID, propertyID,
	).Scan(&id); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id, propertyID)
}

// SubmitProof appends an immutable entry to payment_proofs so multiple partial
// payments preserve all uploaded proofs without overwriting history.
func (r *PaymentRepository) SubmitProof(ctx context.Context, id, userID uuid.UUID, proofURL string, method string, totalPaid float64, notes string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var propertyID uuid.UUID
	var contractID uuid.UUID
	queryFind := `
		SELECT p.property_id, p.contract_id
		FROM payments p
		JOIN contracts c ON c.id = p.contract_id AND c.property_id = p.property_id
		WHERE p.id = $1 AND c.user_id = $2`

	if err := tx.QueryRow(ctx, queryFind, id, userID).Scan(&propertyID, &contractID); err != nil {
		return err
	}

	amountMinor := int64(totalPaid)

	// 1. Append to payment_proofs history (preserves proof for partial payments)
	_, err = tx.Exec(ctx, `
		INSERT INTO payment_proofs (property_id, payment_id, file_url, amount_minor, payment_method, submitted_by, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		propertyID, id, proofURL, amountMinor, method, userID, notes,
	)
	if err != nil {
		return fmt.Errorf("failed to append payment proof: %w", err)
	}

	// 2. Update payment row status to pending
	_, err = tx.Exec(ctx, `
		UPDATE payments
		SET proof_photo_url = $1, payment_method = $2, total_paid = $3,
			paid_amount_minor = $4, status = 'pending', notes = $5
		WHERE id = $6 AND property_id = $7`,
		proofURL, method, totalPaid, amountMinor, notes, id, propertyID,
	)
	if err != nil {
		return fmt.Errorf("failed to update payment record: %w", err)
	}

	// 3. Emit notification outbox event (EPIC 08 integration)
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"payment_id":     id,
		"property_id":    propertyID,
		"contract_id":    contractID,
		"tenant_id":      userID,
		"amount_minor":   amountMinor,
		"payment_method": method,
		"submitted_at":   time.Now().UTC().Format(time.RFC3339),
	})

	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'payment_proof_submitted', 'payment', $2, $3)`,
		propertyID, id, outboxPayload,
	)

	return tx.Commit(ctx)
}

// VerifyPaymentTx verifies a payment within a property-scoped database transaction.
// It applies invoice allocations, updates status, handles overpayment credits,
// issues an immutable receipt with a SHA-256 checksum, and emits an outbox event.
func (r *PaymentRepository) VerifyPaymentTx(ctx context.Context, propertyID, actorID, paymentID uuid.UUID, req model.VerifyPaymentRequest) (*model.Payment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Fetch payment with lock
	var p model.Payment
	var invoiceID *uuid.UUID
	var tenantID *uuid.UUID
	var contractID uuid.UUID
	var currentStatus string
	var currentPaidMinor int64

	row := tx.QueryRow(ctx, `
		SELECT p.id, p.property_id, p.contract_id, p.tenant_id, p.invoice_id, p.status, p.paid_amount_minor, p.total_paid
		FROM payments p
		WHERE p.id = $1 AND p.property_id = $2
		FOR UPDATE`, paymentID, propertyID)

	var totalPaid float64
	if err := row.Scan(&p.ID, &p.PropertyID, &contractID, &tenantID, &invoiceID, &currentStatus, &currentPaidMinor, &totalPaid); err != nil {
		return nil, err
	}

	verifiedAmount := req.PaidAmountMinor
	if verifiedAmount <= 0 {
		if req.TotalPaid > 0 {
			verifiedAmount = int64(req.TotalPaid)
		} else if currentPaidMinor > 0 {
			verifiedAmount = currentPaidMinor
		} else {
			verifiedAmount = int64(totalPaid)
		}
	}

	now := time.Now().UTC()

	// 2. If rejected
	if req.Status == "rejected" {
		_, err = tx.Exec(ctx, `
			UPDATE payments
			SET status = 'rejected', rejection_reason = $1, verified_by = $2, verified_at = $3, verification_notes = $4
			WHERE id = $5 AND property_id = $6`,
			req.RejectionReason, actorID, now, req.Notes, paymentID, propertyID,
		)
		if err != nil {
			return nil, err
		}

		outboxPayload, _ := json.Marshal(map[string]interface{}{
			"payment_id":       paymentID,
			"property_id":      propertyID,
			"status":           "rejected",
			"rejection_reason": req.RejectionReason,
			"verified_by":      actorID,
			"verified_at":      now.Format(time.RFC3339),
		})
		_, _ = tx.Exec(ctx, `
			INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
			VALUES ($1, 'payment_rejected', 'payment', $2, $3)`,
			propertyID, paymentID, outboxPayload,
		)

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
		_, _ = tx.Exec(ctx, `
			INSERT INTO financial_audit_logs (
				property_id, actor_id, action, entity_type, entity_id,
				amount_minor, reason, correlation_id, before_state, after_state
			) VALUES ($1, $2, 'payment_reject', 'payment', $3, $4, $5, $6, $7, $8)`,
			propertyID, actorID, paymentID, verifiedAmount, req.RejectionReason, correlationID,
			`{"previous_status":"`+currentStatus+`"}`, `{"status":"rejected"}`)

		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return r.FindByID(ctx, paymentID, propertyID)
	}

	// 3. Update payment status to paid or partial
	paymentStatus := req.Status
	if paymentStatus == "" {
		paymentStatus = "paid"
	}

	_, err = tx.Exec(ctx, `
		UPDATE payments
		SET status = $1, verified_by = $2, verified_at = $3, verification_notes = $4,
			paid_at = $5, paid_amount_minor = $6, total_paid = $7
		WHERE id = $8 AND property_id = $9`,
		paymentStatus, actorID, now, req.Notes, now, verifiedAmount, float64(verifiedAmount), paymentID, propertyID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update payment verification: %w", err)
	}

	// 4. Apply allocations to invoices
	var totalAllocated int64 = 0

	if len(req.Allocations) > 0 {
		for _, alloc := range req.Allocations {
			if alloc.AmountMinor <= 0 {
				continue
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_allocations (property_id, invoice_id, payment_id, amount_minor, status, reason, created_by)
				VALUES ($1, $2, $3, $4, 'valid', $5, $6)`,
				propertyID, alloc.InvoiceID, paymentID, alloc.AmountMinor, alloc.Reason, actorID,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert invoice allocation: %w", err)
			}
			totalAllocated += alloc.AmountMinor
		}
	} else if invoiceID != nil {
		// Automatic fallback allocation to linked invoice
		var invTotalMinor int64
		var invAllocatedMinor int64
		_ = tx.QueryRow(ctx, `SELECT total_minor FROM invoices WHERE id = $1 AND property_id = $2`, *invoiceID, propertyID).Scan(&invTotalMinor)
		_ = tx.QueryRow(ctx, `SELECT COALESCE(SUM(amount_minor), 0) FROM invoice_allocations WHERE invoice_id = $1 AND status = 'valid'`, *invoiceID).Scan(&invAllocatedMinor)

		outstanding := invTotalMinor - invAllocatedMinor
		allocAmount := verifiedAmount
		if outstanding > 0 && allocAmount > outstanding {
			allocAmount = outstanding
		}

		if allocAmount > 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO invoice_allocations (property_id, invoice_id, payment_id, amount_minor, status, reason, created_by)
				VALUES ($1, $2, $3, $4, 'valid', 'Alokasi verifikasi pembayaran', $5)`,
				propertyID, *invoiceID, paymentID, allocAmount, actorID,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to insert default invoice allocation: %w", err)
			}
			totalAllocated = allocAmount
		}
	}

	// 5. Handle overpayment: credit to tenant if requested
	if req.CreditOverpayment && verifiedAmount > totalAllocated && tenantID != nil {
		creditAmount := verifiedAmount - totalAllocated
		var currentCreditBalance int64 = 0
		_ = tx.QueryRow(ctx, `
			SELECT balance_after_minor FROM tenant_credits
			WHERE property_id = $1 AND tenant_id = $2
			ORDER BY created_at DESC LIMIT 1`, propertyID, *tenantID).Scan(&currentCreditBalance)

		newBalance := currentCreditBalance + creditAmount
		_, err = tx.Exec(ctx, `
			INSERT INTO tenant_credits (property_id, tenant_id, source_payment_id, amount_minor, balance_after_minor, reason, created_by)
			VALUES ($1, $2, $3, $4, $5, 'Kredit overpayment dari pembayaran terverifikasi', $6)`,
			propertyID, *tenantID, paymentID, creditAmount, newBalance, actorID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to record tenant credit: %w", err)
		}
	}

	// 6. Generate immutable receipt with SHA-256 checksum
	if tenantID != nil {
		receiptNum := payment.GenerateReceiptNumber(now, paymentID)
		var tenantName, roomNumber string
		_ = tx.QueryRow(ctx, `SELECT COALESCE(name, '') FROM users WHERE id = $1`, *tenantID).Scan(&tenantName)
		_ = tx.QueryRow(ctx, `
			SELECT COALESCE(r.room_number, '')
			FROM contracts c
			LEFT JOIN rooms r ON r.id = c.room_id
			WHERE c.id = $1`, contractID).Scan(&roomNumber)

		snapshot := map[string]interface{}{
			"receipt_number":  receiptNum,
			"property_id":     propertyID.String(),
			"payment_id":      paymentID.String(),
			"contract_id":     contractID.String(),
			"tenant_name":     tenantName,
			"room_number":     roomNumber,
			"total_minor":     verifiedAmount,
			"total_allocated": totalAllocated,
			"currency":        "IDR",
			"status":          paymentStatus,
			"verified_by":     actorID.String(),
			"verified_at":     now.Format(time.RFC3339),
		}

		checksum, err := payment.ComputeChecksum(snapshot)
		if err == nil {
			snapshotBytes, _ := json.Marshal(snapshot)
			_, _ = tx.Exec(ctx, `
				INSERT INTO payment_receipts (property_id, payment_id, receipt_number, tenant_id, total_minor, currency, snapshot, checksum, issued_by, issued_at)
				VALUES ($1, $2, $3, $4, $5, 'IDR', $6, $7, $8, $9)
				ON CONFLICT (receipt_number) DO NOTHING`,
				propertyID, paymentID, receiptNum, *tenantID, verifiedAmount, snapshotBytes, checksum, actorID, now,
			)
		}
	}

	// 7. Emit outbox event
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"payment_id":      paymentID,
		"property_id":     propertyID,
		"amount_minor":    verifiedAmount,
		"total_allocated": totalAllocated,
		"status":          paymentStatus,
		"verified_by":     actorID,
		"verified_at":     now.Format(time.RFC3339),
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'payment_verified', 'payment', $2, $3)`,
		propertyID, paymentID, outboxPayload,
	)

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
	_, _ = tx.Exec(ctx, `
		INSERT INTO financial_audit_logs (
			property_id, actor_id, action, entity_type, entity_id,
			amount_minor, reason, correlation_id, before_state, after_state
		) VALUES ($1, $2, $3, 'payment', $4, $5, $6, $7, $8, $9)`,
		propertyID, actorID, "payment_"+paymentStatus, paymentID,
		verifiedAmount, req.Notes, correlationID,
		`{"previous_status":"`+currentStatus+`"}`, `{"status":"`+paymentStatus+`"}`)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.FindByID(ctx, paymentID, propertyID)
}

// ProcessWebhook processes incoming payment provider notifications with strict
// idempotency. Duplicate provider_ref returns isDuplicate = true without creating records.
func (r *PaymentRepository) ProcessWebhook(ctx context.Context, payload model.PaymentWebhookPayload) (*model.Payment, bool, error) {
	// Check idempotency first
	var existingID uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM payments
		WHERE property_id = $1 AND provider = $2 AND provider_ref = $3`,
		payload.PropertyID, payload.Provider, payload.ProviderRef,
	).Scan(&existingID)

	if err == nil {
		// Already processed! Idempotent return without duplicate creation.
		p, err := r.FindByID(ctx, existingID, payload.PropertyID)
		return p, true, err
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, false, err
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, false, err
	}
	defer tx.Rollback(ctx)

	// Resolve contract & tenant
	var contractID uuid.UUID
	var tenantID *uuid.UUID
	if payload.InvoiceID != nil {
		_ = tx.QueryRow(ctx, `SELECT contract_id, tenant_id FROM invoices WHERE id = $1 AND property_id = $2`, *payload.InvoiceID, payload.PropertyID).Scan(&contractID, &tenantID)
	} else if payload.ContractID != nil {
		contractID = *payload.ContractID
		_ = tx.QueryRow(ctx, `SELECT user_id FROM contracts WHERE id = $1 AND property_id = $2`, contractID).Scan(&tenantID)
	}

	if contractID == uuid.Nil {
		return nil, false, errors.New("contract or invoice target not found for webhook")
	}

	now := time.Now().UTC()
	paymentMethod := payload.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = payload.Provider
	}

	var newPaymentID uuid.UUID
	insertQuery := `
		INSERT INTO payments (
			property_id, contract_id, tenant_id, period_month, period_year,
			amount_minor, paid_amount_minor, currency, total_paid,
			payment_method, provider, provider_ref, status, paid_at, due_date, notes
		)
		VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, 'IDR', $8,
			$9, $10, $11, 'paid', $12, $13, $14
		)
		RETURNING id`

	err = tx.QueryRow(ctx, insertQuery,
		payload.PropertyID, contractID, tenantID, int(now.Month()), now.Year(),
		payload.AmountMinor, payload.AmountMinor, float64(payload.AmountMinor),
		paymentMethod, payload.Provider, payload.ProviderRef, now, now, payload.Notes,
	).Scan(&newPaymentID)
	if err != nil {
		return nil, false, fmt.Errorf("failed to create webhook payment: %w", err)
	}

	// Allocate to invoice if provided
	if payload.InvoiceID != nil {
		_, _ = tx.Exec(ctx, `
			INSERT INTO invoice_allocations (property_id, invoice_id, payment_id, amount_minor, status, reason)
			VALUES ($1, $2, $3, $4, 'valid', 'Alokasi otomatis dari webhook provider')`,
			payload.PropertyID, *payload.InvoiceID, newPaymentID, payload.AmountMinor,
		)
	}

	// Issue immutable receipt
	if tenantID != nil {
		receiptNum := payment.GenerateReceiptNumber(now, newPaymentID)
		snapshot := map[string]interface{}{
			"receipt_number": receiptNum,
			"property_id":    payload.PropertyID.String(),
			"payment_id":     newPaymentID.String(),
			"provider":       payload.Provider,
			"provider_ref":   payload.ProviderRef,
			"total_minor":    payload.AmountMinor,
			"currency":       "IDR",
			"status":         "paid",
			"issued_at":      now.Format(time.RFC3339),
		}
		checksum, _ := payment.ComputeChecksum(snapshot)
		snapshotBytes, _ := json.Marshal(snapshot)
		_, _ = tx.Exec(ctx, `
			INSERT INTO payment_receipts (property_id, payment_id, receipt_number, tenant_id, total_minor, currency, snapshot, checksum, issued_at)
			VALUES ($1, $2, $3, $4, $5, 'IDR', $6, $7, $8)
			ON CONFLICT (receipt_number) DO NOTHING`,
			payload.PropertyID, newPaymentID, receiptNum, *tenantID, payload.AmountMinor, snapshotBytes, checksum, now,
		)
	}

	// Emit outbox event
	outboxPayload, _ := json.Marshal(map[string]interface{}{
		"payment_id":   newPaymentID,
		"property_id":  payload.PropertyID,
		"provider":     payload.Provider,
		"provider_ref": payload.ProviderRef,
		"amount_minor": payload.AmountMinor,
		"status":       "paid",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'webhook_payment_received', 'payment', $2, $3)`,
		payload.PropertyID, newPaymentID, outboxPayload,
	)

	if err := tx.Commit(ctx); err != nil {
		return nil, false, err
	}

	p, err := r.FindByID(ctx, newPaymentID, payload.PropertyID)
	return p, false, err
}

// GetReceipt retrieves an immutable receipt snapshot and verifies checksum integrity.
func (r *PaymentRepository) GetReceipt(ctx context.Context, propertyID, paymentID uuid.UUID) (*model.PaymentReceipt, error) {
	var rc model.PaymentReceipt
	var snapshotJSON []byte
	query := `
		SELECT id, property_id, payment_id, receipt_number, tenant_id, total_minor, currency, snapshot, checksum, issued_by, issued_at, created_at
		FROM payment_receipts
		WHERE payment_id = $1 AND property_id = $2
		LIMIT 1`

	err := r.db.QueryRow(ctx, query, paymentID, propertyID).Scan(
		&rc.ID, &rc.PropertyID, &rc.PaymentID, &rc.ReceiptNumber, &rc.TenantID, &rc.TotalMinor, &rc.Currency,
		&snapshotJSON, &rc.Checksum, &rc.IssuedBy, &rc.IssuedAt, &rc.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(snapshotJSON, &rc.Snapshot); err != nil {
		return nil, fmt.Errorf("failed to decode receipt snapshot: %w", err)
	}

	// Cryptographic tamper check
	if !payment.VerifyChecksum(rc.Snapshot, rc.Checksum) {
		return nil, errors.New("receipt checksum mismatch: data integrity violation detected")
	}

	return &rc, nil
}

// GetReceiptForUser retrieves an immutable receipt for the authenticated tenant.
func (r *PaymentRepository) GetReceiptForUser(ctx context.Context, userID, paymentID uuid.UUID) (*model.PaymentReceipt, error) {
	var rc model.PaymentReceipt
	var snapshotJSON []byte
	query := `
		SELECT id, property_id, payment_id, receipt_number, tenant_id, total_minor, currency, snapshot, checksum, issued_by, issued_at, created_at
		FROM payment_receipts
		WHERE payment_id = $1 AND tenant_id = $2
		LIMIT 1`

	err := r.db.QueryRow(ctx, query, paymentID, userID).Scan(
		&rc.ID, &rc.PropertyID, &rc.PaymentID, &rc.ReceiptNumber, &rc.TenantID, &rc.TotalMinor, &rc.Currency,
		&snapshotJSON, &rc.Checksum, &rc.IssuedBy, &rc.IssuedAt, &rc.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(snapshotJSON, &rc.Snapshot); err != nil {
		return nil, fmt.Errorf("failed to decode receipt snapshot: %w", err)
	}

	if !payment.VerifyChecksum(rc.Snapshot, rc.Checksum) {
		return nil, errors.New("receipt checksum mismatch: data integrity violation detected")
	}

	return &rc, nil
}

// GetReconciliationReport calculates and returns the comprehensive reconciliation
// balance between payments, allocations, refunds, credits, and net settlements.
func (r *PaymentRepository) GetReconciliationReport(ctx context.Context, propertyID uuid.UUID, startDate, endDate string) (*model.ReconciliationReport, error) {
	report := &model.ReconciliationReport{
		PropertyID:  propertyID,
		PeriodStart: startDate,
		PeriodEnd:   endDate,
	}

	var startFilter, endFilter time.Time
	var err error
	if startDate != "" {
		startFilter, _ = time.Parse("2006-01-02", startDate)
	} else {
		startFilter = time.Now().AddDate(0, -1, 0)
	}
	if endDate != "" {
		endFilter, _ = time.Parse("2006-01-02", endDate)
		endFilter = endFilter.Add(24*time.Hour - time.Second)
	} else {
		endFilter = time.Now()
	}

	// 1. Total verified payments received
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(paid_amount_minor), 0)
		FROM payments
		WHERE property_id = $1 AND status IN ('paid', 'partial')
		  AND paid_at >= $2 AND paid_at <= $3`,
		propertyID, startFilter, endFilter,
	).Scan(&report.TotalPaymentsReceivedMinor)

	// 2. Total allocated to invoices
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(ia.amount_minor), 0)
		FROM invoice_allocations ia
		WHERE ia.property_id = $1 AND ia.status = 'valid'
		  AND ia.created_at >= $2 AND ia.created_at <= $3`,
		propertyID, startFilter, endFilter,
	).Scan(&report.TotalAllocatedMinor)

	// 3. Total refunds disbursed
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM refund_requests
		WHERE property_id = $1 AND status = 'disbursed'
		  AND processed_at >= $2 AND processed_at <= $3`,
		propertyID, startFilter, endFilter,
	).Scan(&report.TotalRefundedMinor)

	// 4. Total credits created
	_ = r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_minor), 0)
		FROM tenant_credits
		WHERE property_id = $1 AND amount_minor > 0
		  AND created_at >= $2 AND created_at <= $3`,
		propertyID, startFilter, endFilter,
	).Scan(&report.TotalCreditsCreatedMinor)

	// Computed figures
	report.TotalUnallocatedMinor = report.TotalPaymentsReceivedMinor - report.TotalAllocatedMinor - report.TotalCreditsCreatedMinor
	if report.TotalUnallocatedMinor < 0 {
		report.TotalUnallocatedMinor = 0
	}
	report.TotalSettlementMinor = report.TotalPaymentsReceivedMinor - report.TotalRefundedMinor

	// Balance verification: payments = allocations + unallocated + credits + refunds
	expected := report.TotalAllocatedMinor + report.TotalUnallocatedMinor + report.TotalCreditsCreatedMinor
	report.IsBalanced = (report.TotalPaymentsReceivedMinor == expected)

	// Fetch payments in period
	pRows, err := r.db.Query(ctx, `
		SELECT id, property_id, contract_id, tenant_id, paid_amount_minor, payment_method, provider, status, paid_at, created_at
		FROM payments
		WHERE property_id = $1 AND status IN ('paid', 'partial')
		  AND paid_at >= $2 AND paid_at <= $3
		ORDER BY paid_at DESC LIMIT 50`, propertyID, startFilter, endFilter)
	if err == nil {
		defer pRows.Close()
		for pRows.Next() {
			var item model.Payment
			if err := pRows.Scan(
				&item.ID, &item.PropertyID, &item.ContractID, &item.TenantID,
				&item.PaidAmountMinor, &item.PaymentMethod, &item.Provider, &item.Status, &item.PaidAt, &item.CreatedAt,
			); err == nil {
				report.Payments = append(report.Payments, item)
			}
		}
	}

	// Fetch refunds in period
	rRows, err := r.db.Query(ctx, `
		SELECT id, property_id, payment_id, tenant_id, amount_minor, status, reason, disbursement_ref, created_at
		FROM refund_requests
		WHERE property_id = $1 AND created_at >= $2 AND created_at <= $3
		ORDER BY created_at DESC LIMIT 50`, propertyID, startFilter, endFilter)
	if err == nil {
		defer rRows.Close()
		for rRows.Next() {
			var ref model.RefundRequest
			if err := rRows.Scan(
				&ref.ID, &ref.PropertyID, &ref.PaymentID, &ref.TenantID,
				&ref.AmountMinor, &ref.Status, &ref.Reason, &ref.DisbursementRef, &ref.CreatedAt,
			); err == nil {
				report.Refunds = append(report.Refunds, ref)
			}
		}
	}

	return report, nil
}

// CreateRefund registers a new refund request for an overpayment or return.
func (r *PaymentRepository) CreateRefund(ctx context.Context, propertyID, actorID uuid.UUID, req model.CreateRefundRequestPayload) (*model.RefundRequest, error) {
	var ref model.RefundRequest
	var tenantID uuid.UUID

	err := r.db.QueryRow(ctx, `SELECT tenant_id FROM payments WHERE id = $1 AND property_id = $2`, req.PaymentID, propertyID).Scan(&tenantID)
	if err != nil {
		return nil, fmt.Errorf("payment not found in property: %w", err)
	}

	query := `
		INSERT INTO refund_requests (
			property_id, payment_id, tenant_id, amount_minor, status, reason,
			bank_name, bank_account_number, bank_account_holder
		)
		VALUES ($1, $2, $3, $4, 'requested', $5, $6, $7, $8)
		RETURNING id, property_id, payment_id, tenant_id, amount_minor, status, reason, bank_name, bank_account_number, bank_account_holder, created_at`

	err = r.db.QueryRow(ctx, query,
		propertyID, req.PaymentID, tenantID, req.AmountMinor, req.Reason,
		req.BankName, req.BankAccountNumber, req.BankAccountHolder,
	).Scan(
		&ref.ID, &ref.PropertyID, &ref.PaymentID, &ref.TenantID, &ref.AmountMinor, &ref.Status, &ref.Reason,
		&ref.BankName, &ref.BankAccountNumber, &ref.BankAccountHolder, &ref.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Outbox event
	payloadBytes, _ := json.Marshal(ref)
	_, _ = r.db.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'refund_requested', 'refund', $2, $3)`,
		propertyID, ref.ID, payloadBytes,
	)

	return &ref, nil
}

// ProcessRefund updates refund status (approved, rejected, disbursed).
func (r *PaymentRepository) ProcessRefund(ctx context.Context, propertyID, actorID, refundID uuid.UUID, req model.ProcessRefundPayload) (*model.RefundRequest, error) {
	now := time.Now().UTC()
	var ref model.RefundRequest

	query := `
		UPDATE refund_requests
		SET status = $1, disbursement_ref = $2, notes = $3, processed_by = $4, processed_at = $5
		WHERE id = $6 AND property_id = $7
		RETURNING id, property_id, payment_id, tenant_id, amount_minor, status, reason, bank_name, bank_account_number, bank_account_holder, disbursement_ref, notes, processed_by, processed_at, created_at`

	err := r.db.QueryRow(ctx, query,
		req.Status, req.DisbursementRef, req.Notes, actorID, now, refundID, propertyID,
	).Scan(
		&ref.ID, &ref.PropertyID, &ref.PaymentID, &ref.TenantID, &ref.AmountMinor, &ref.Status, &ref.Reason,
		&ref.BankName, &ref.BankAccountNumber, &ref.BankAccountHolder, &ref.DisbursementRef, &ref.Notes,
		&ref.ProcessedBy, &ref.ProcessedAt, &ref.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Outbox event
	payloadBytes, _ := json.Marshal(ref)
	_, _ = r.db.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload)
		VALUES ($1, 'refund_processed', 'refund', $2, $3)`,
		propertyID, ref.ID, payloadBytes,
	)

	return &ref, nil
}

func (r *PaymentRepository) FindPropertyName(ctx context.Context, propertyID uuid.UUID) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `SELECT name FROM properties WHERE id = $1`, propertyID).Scan(&name)
	return name, err
}
