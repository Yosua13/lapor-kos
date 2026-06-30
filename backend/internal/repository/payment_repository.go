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

func (r *PaymentRepository) Create(ctx context.Context, p *model.Payment) error {
	query := `INSERT INTO payments (
		contract_id, owner_id, period_month, period_year, 
		amount_rent, amount_electricity, amount_water, amount_other, 
		total_paid, payment_method, status, proof_photo_url, 
		paid_at, due_date, notes
	) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	RETURNING id, created_at`

	err := r.db.QueryRow(ctx, query,
		p.ContractID, p.OwnerID, p.PeriodMonth, p.PeriodYear,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		p.TotalPaid, p.PaymentMethod, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.DueDate, p.Notes,
	).Scan(&p.ID, &p.CreatedAt)

	return err
}

func (r *PaymentRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	query := `SELECT 
		p.id, p.contract_id, p.owner_id, p.period_month, p.period_year, 
		COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0), COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0), 
		COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status, COALESCE(p.proof_photo_url, ''), 
		p.paid_at, p.due_date, COALESCE(p.notes, ''), p.created_at,
		c.owner_id, COALESCE(c.monthly_rent, 0), COALESCE(c.deposit, 0), COALESCE(c.payment_due_day, 1),
		r.room_number, r.price_per_month,
		u.name, u.phone, u.id
	FROM payments p
	JOIN contracts c ON p.contract_id = c.id
	LEFT JOIN rooms r ON c.room_id = r.id
	LEFT JOIN users u ON c.user_id = u.id
	WHERE p.id = $1`

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

	err := r.db.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.ContractID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
		&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
		&p.TotalPaid, &p.PaymentMethod, &p.Status, &p.ProofPhotoURL,
		&paidAt, &p.DueDate, &p.Notes, &p.CreatedAt,
		&contractOwnerID,
		&contractRent, &contractDeposit, &contractDueDay,
		&roomNum, &roomPrice,
		&userName, &userPhone, &userID,
	)
	if err != nil {
		return nil, err
	}

	p.PaidAt = paidAt
	p.OwnerID = ownerID

	p.Contract = &model.Contract{
		ID:      p.ContractID,
		OwnerID: contractOwnerID,
	}
	if contractRent != nil {
		p.Contract.MonthlyRent = *contractRent
		p.Contract.Deposit = *contractDeposit
		p.Contract.PaymentDueDay = *contractDueDay
	}
	if roomNum != nil {
		p.Contract.Room = &model.Room{
			RoomNumber:    *roomNum,
			PricePerMonth: *roomPrice,
		}
	}
	if userName != nil && userID != nil {
		p.Contract.User = &model.User{
			Name:  *userName,
			Phone: *userPhone,
			ID:    *userID,
		}
	}

	return p, nil
}

func (r *PaymentRepository) FindAll(ctx context.Context, ownerID uuid.UUID, filterStatus string, filterMonth int, filterYear int, contractIDStr string, userIDStr string) ([]model.Payment, error) {
	query := `SELECT 
		p.id, p.contract_id, p.owner_id, p.period_month, p.period_year, 
		COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0), COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0), 
		COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status, COALESCE(p.proof_photo_url, ''), 
		p.paid_at, p.due_date, COALESCE(p.notes, ''), p.created_at,
		r.room_number, u.name, u.phone, COALESCE(c.deposit, 0)
	FROM payments p
	JOIN contracts c ON p.contract_id = c.id
	LEFT JOIN rooms r ON c.room_id = r.id
	LEFT JOIN users u ON c.user_id = u.id
	WHERE (p.owner_id = $1 OR c.owner_id = $1)`

	args := []interface{}{ownerID}
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
		if parsedID, err := uuid.Parse(contractIDStr); err == nil {
			query += fmt.Sprintf(" AND p.contract_id = $%d", argIdx)
			args = append(args, parsedID)
			argIdx++
		}
	}
	if userIDStr != "" {
		if parsedID, err := uuid.Parse(userIDStr); err == nil {
			query += fmt.Sprintf(" AND c.user_id = $%d", argIdx)
			args = append(args, parsedID)
			argIdx++
		}
	}

	query += " ORDER BY p.due_date DESC, p.created_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []model.Payment
	for rows.Next() {
		var p model.Payment
		var paidAt *time.Time
		var ownerID *uuid.UUID
		var roomNum *string
		var userName *string
		var userPhone *string
		var deposit float64

		err := rows.Scan(
			&p.ID, &p.ContractID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
			&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
			&p.TotalPaid, &p.PaymentMethod, &p.Status, &p.ProofPhotoURL,
			&paidAt, &p.DueDate, &p.Notes, &p.CreatedAt,
			&roomNum, &userName, &userPhone, &deposit,
		)
		if err != nil {
			return nil, err
		}

		p.PaidAt = paidAt
		p.OwnerID = ownerID
		p.Contract = &model.Contract{
			ID:      p.ContractID,
			Deposit: deposit,
		}
		if roomNum != nil {
			p.Contract.Room = &model.Room{RoomNumber: *roomNum}
		}
		if userName != nil {
			user := &model.User{Name: *userName}
			if userPhone != nil {
				user.Phone = *userPhone
			}
			p.Contract.User = user
		}

		payments = append(payments, p)
	}

	return payments, nil
}

func (r *PaymentRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]model.Payment, error) {
	query := `SELECT 
		p.id, p.contract_id, p.owner_id, p.period_month, p.period_year, 
		COALESCE(p.amount_rent, 0), COALESCE(p.amount_electricity, 0), COALESCE(p.amount_water, 0), COALESCE(p.amount_other, 0), 
		COALESCE(p.total_paid, 0), COALESCE(p.payment_method, ''), p.status, COALESCE(p.proof_photo_url, ''), 
		p.paid_at, p.due_date, COALESCE(p.notes, ''), p.created_at,
		r.room_number, u.name, u.phone, COALESCE(c.deposit, 0)
	FROM payments p
	JOIN contracts c ON p.contract_id = c.id
	LEFT JOIN rooms r ON c.room_id = r.id
	LEFT JOIN users u ON c.user_id = u.id
	WHERE c.user_id = $1
	ORDER BY p.due_date DESC, p.created_at DESC`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []model.Payment
	for rows.Next() {
		var p model.Payment
		var paidAt *time.Time
		var ownerID *uuid.UUID
		var roomNum *string
		var userName *string
		var userPhone *string
		var deposit float64

		err := rows.Scan(
			&p.ID, &p.ContractID, &ownerID, &p.PeriodMonth, &p.PeriodYear,
			&p.AmountRent, &p.AmountElectricity, &p.AmountWater, &p.AmountOther,
			&p.TotalPaid, &p.PaymentMethod, &p.Status, &p.ProofPhotoURL,
			&paidAt, &p.DueDate, &p.Notes, &p.CreatedAt,
			&roomNum, &userName, &userPhone, &deposit,
		)
		if err != nil {
			return nil, err
		}

		p.PaidAt = paidAt
		p.OwnerID = ownerID
		p.Contract = &model.Contract{
			ID:      p.ContractID,
			Deposit: deposit,
		}
		if roomNum != nil {
			p.Contract.Room = &model.Room{RoomNumber: *roomNum}
		}
		if userName != nil {
			user := &model.User{Name: *userName}
			if userPhone != nil {
				user.Phone = *userPhone
			}
			p.Contract.User = user
		}

		payments = append(payments, p)
	}

	return payments, nil
}

func (r *PaymentRepository) Update(ctx context.Context, p *model.Payment) error {
	query := `UPDATE payments SET 
		amount_rent = $1, amount_electricity = $2, amount_water = $3, amount_other = $4,
		total_paid = $5, payment_method = $6, status = $7, proof_photo_url = $8,
		paid_at = $9, notes = $10, owner_id = $11
	WHERE id = $12`

	_, err := r.db.Exec(ctx, query,
		p.AmountRent, p.AmountElectricity, p.AmountWater, p.AmountOther,
		p.TotalPaid, p.PaymentMethod, p.Status, p.ProofPhotoURL,
		p.PaidAt, p.Notes, p.OwnerID, p.ID,
	)
	return err
}

func (r *PaymentRepository) SubmitProof(ctx context.Context, id uuid.UUID, proofURL string, method string, totalPaid float64, notes string) error {
	query := `UPDATE payments SET 
		proof_photo_url = $1, payment_method = $2, total_paid = $3, 
		status = 'pending', notes = $4
	WHERE id = $5`
	_, err := r.db.Exec(ctx, query, proofURL, method, totalPaid, notes, id)
	return err
}

func (r *PaymentRepository) FindActiveContractByUserID(ctx context.Context, userID uuid.UUID) (*model.Contract, error) {
	query := `SELECT c.id, c.room_id, c.user_id, c.owner_id, c.start_date, c.end_date, 
	                 c.rental_duration, c.monthly_rent, c.total_price, c.deposit, c.payment_due_day, c.status
	          FROM contracts c
	          WHERE c.user_id = $1 AND c.status = 'active'
	          LIMIT 1`
	c := &model.Contract{}
	err := r.db.QueryRow(ctx, query, userID).Scan(
		&c.ID, &c.RoomID, &c.UserID, &c.OwnerID, &c.StartDate, &c.EndDate,
		&c.RentalDuration, &c.MonthlyRent, &c.TotalPrice, &c.Deposit, &c.PaymentDueDay, &c.Status,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}
