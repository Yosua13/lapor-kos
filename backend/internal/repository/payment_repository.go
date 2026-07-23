package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
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
	query := `
		INSERT INTO payments (
			property_id, contract_id, owner_id, period_month, period_year,
			amount_rent, amount_electricity, amount_water, amount_other,
			total_paid, payment_method, status, proof_photo_url,
			paid_at, due_date, notes
		)
		SELECT
			c.property_id, c.id, $3, $4, $5,
			$6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
		FROM contracts c
		WHERE c.id = $1 AND c.property_id = $2
		RETURNING id, property_id, created_at`

	return r.db.QueryRow(ctx, query,
		p.ContractID, p.PropertyID, p.OwnerID, p.PeriodMonth, p.PeriodYear,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		p.TotalPaid, p.PaymentMethod, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.DueDate, p.Notes,
	).Scan(&p.ID, &p.PropertyID, &p.CreatedAt)
}

const paymentDetailsSelect = `
	SELECT
		p.id, p.property_id, p.contract_id, p.owner_id, p.period_month, p.period_year,
		COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
		COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
		COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status,
		COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
		COALESCE(p.notes, ''), p.created_at,
		c.owner_id, COALESCE(c.monthly_rent, 0), COALESCE(c.deposit, 0),
		COALESCE(c.payment_due_day, 1), r.room_number, r.price_per_month,
		u.name, u.phone, u.id
	FROM payments p
	JOIN contracts c ON c.id = p.contract_id AND c.property_id = p.property_id
	LEFT JOIN rooms r ON r.id = c.room_id AND r.property_id = c.property_id
	LEFT JOIN users u ON u.id = c.user_id`

// FindByID is intentionally property-scoped for staff-facing reads. A UUID
// from another property produces pgx.ErrNoRows, which handlers map to 404.
func (r *PaymentRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*model.Payment, error) {
	query := paymentDetailsSelect + ` WHERE p.id = $1 AND p.property_id = $2`
	return scanPayment(r.db.QueryRow(ctx, query, id, propertyID))
}

// FindByIDForUser is the tenant self-service equivalent. It derives property
// access through the payment's contract instead of trusting a property header.
func (r *PaymentRepository) FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*model.Payment, error) {
	query := paymentDetailsSelect + ` WHERE p.id = $1 AND c.user_id = $2`
	return scanPayment(r.db.QueryRow(ctx, query, id, userID))
}

func scanPayment(row pgx.Row) (*model.Payment, error) {
	p := &model.Payment{}
	var paidAt *time.Time
	var ownerID *uuid.UUID
	var roomNum *string
	var roomPrice *float64
	var userName, userPhone *string
	var userID *uuid.UUID
	var contractOwnerID uuid.UUID
	var contractRent, contractDeposit *float64
	var contractDueDay *int

	err := row.Scan(
		&p.ID, &p.PropertyID, &p.ContractID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
		&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
		&p.TotalPaid, &p.PaymentMethod, &p.Status, &p.ProofPhotoURL,
		&paidAt, &p.DueDate, &p.Notes, &p.CreatedAt,
		&contractOwnerID, &contractRent, &contractDeposit, &contractDueDay,
		&roomNum, &roomPrice, &userName, &userPhone, &userID,
	)
	if err != nil {
		return nil, err
	}

	p.PaidAt = paidAt
	p.OwnerID = ownerID
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
			p.id, p.property_id, p.contract_id, p.owner_id, p.period_month, p.period_year,
			COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
			COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
			COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status,
			COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
			COALESCE(p.notes, ''), p.created_at,
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

// FindByUserID returns only payments connected to the authenticated user's
// contracts. Property identity is derived by the contract/payment join.
func (r *PaymentRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]model.Payment, error) {
	query := `
		SELECT
			p.id, p.property_id, p.contract_id, p.owner_id, p.period_month, p.period_year,
			COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0),
			COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0),
			COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status,
			COALESCE(p.proof_photo_url, ''), p.paid_at, p.due_date,
			COALESCE(p.notes, ''), p.created_at,
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
		var paidAt *time.Time
		var ownerID *uuid.UUID
		var roomNum, userName, userPhone *string
		var deposit float64

		if err := rows.Scan(
			&p.ID, &p.PropertyID, &p.ContractID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
			&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
			&p.TotalPaid, &p.PaymentMethod, &p.Status, &p.ProofPhotoURL,
			&paidAt, &p.DueDate, &p.Notes, &p.CreatedAt,
			&roomNum, &userName, &userPhone, &deposit,
		); err != nil {
			return nil, err
		}

		p.PaidAt = paidAt
		p.OwnerID = ownerID
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

// Update performs the authorization predicate in the same statement as the
// mutation. The returned payment is re-read through the same property scope.
func (r *PaymentRepository) Update(ctx context.Context, propertyID uuid.UUID, p *model.Payment) (*model.Payment, error) {
	query := `
		UPDATE payments p
		SET amount_rent = $1, amount_electricity = $2, amount_water = $3,
			amount_other = $4, total_paid = $5, payment_method = $6,
			status = $7, proof_photo_url = $8, paid_at = $9, notes = $10,
			owner_id = $11
		FROM contracts c
		WHERE p.id = $12
		  AND p.property_id = $13
		  AND c.id = p.contract_id
		  AND c.property_id = p.property_id
		RETURNING p.id`

	var id uuid.UUID
	if err := r.db.QueryRow(ctx, query,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		p.TotalPaid, p.PaymentMethod, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.Notes, p.OwnerID, p.ID, propertyID,
	).Scan(&id); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id, propertyID)
}

// SubmitProof authorizes the tenant in the UPDATE itself. A payment UUID that
// is not connected to the authenticated user's contract is indistinguishable
// from a missing payment.
func (r *PaymentRepository) SubmitProof(ctx context.Context, id, userID uuid.UUID, proofURL string, method string, totalPaid float64, notes string) error {
	query := `
		UPDATE payments p
		SET proof_photo_url = $1, payment_method = $2, total_paid = $3,
			status = 'pending', notes = $4
		FROM contracts c
		WHERE p.id = $5
		  AND c.id = p.contract_id
		  AND c.property_id = p.property_id
		  AND c.user_id = $6
		RETURNING p.id`
	var updatedID uuid.UUID
	return r.db.QueryRow(ctx, query, proofURL, method, totalPaid, notes, id, userID).Scan(&updatedID)
}

func (r *PaymentRepository) FindPropertyName(ctx context.Context, propertyID uuid.UUID) (string, error) {
	var name string
	err := r.db.QueryRow(ctx, `SELECT name FROM properties WHERE id = $1`, propertyID).Scan(&name)
	return name, err
}
