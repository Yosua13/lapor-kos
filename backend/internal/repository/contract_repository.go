package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContractRepository struct {
	db *pgxpool.Pool
}

func NewContractRepository(db *pgxpool.Pool) *ContractRepository {
	return &ContractRepository{db: db}
}

func (r *ContractRepository) Create(ctx context.Context, contract *model.Contract) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if contract.RoomID != nil {
		var status string
		err = tx.QueryRow(ctx, "SELECT status FROM rooms WHERE id = $1 FOR UPDATE", contract.RoomID).Scan(&status)
		if err != nil {
			return fmt.Errorf("failed to check room status: %w", err)
		}
		if status != "available" {
			return fmt.Errorf("kamar tidak tersedia (status: %s)", status)
		}
	}

	if contract.PaymentInterval == "" {
		contract.PaymentInterval = "monthly"
	}

	query := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes, electricity_bill, water_bill, other_bills, payment_interval) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id, created_at`
	err = tx.QueryRow(ctx, query, contract.RoomID, contract.UserID, contract.OwnerID, contract.StartDate, contract.EndDate, contract.RentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, contract.PaymentDueDay, contract.Status, contract.Notes, contract.ElectricityBill, contract.WaterBill, contract.OtherBills, contract.PaymentInterval).
		Scan(&contract.ID, &contract.CreatedAt)
	if err != nil {
		return err
	}

	// Create Initial Payment
	dueDate := contract.StartDate.AddDate(0, 1, -3)
	notes := contract.Notes
	if notes == "" {
		notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", contract.PaymentDueDay)
	}

	var pRent, pElec, pWater, pOther float64
	if contract.PaymentInterval == "per_contract" {
		pRent = contract.MonthlyRent * float64(contract.RentalDuration)
		pElec = contract.ElectricityBill * float64(contract.RentalDuration)
		pWater = contract.WaterBill * float64(contract.RentalDuration)
		pOther = (contract.OtherBills * float64(contract.RentalDuration)) + contract.Deposit
	} else {
		pRent = contract.MonthlyRent
		pElec = contract.ElectricityBill
		pWater = contract.WaterBill
		pOther = contract.OtherBills + contract.Deposit
	}

	paymentID := uuid.New()
	paymentQuery := `INSERT INTO payments (id, contract_id, owner_id, period_month, period_year, amount_rent, amount_electricity, amount_water, amount_other, total_paid, payment_method, status, due_date, notes)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	_, err = tx.Exec(ctx, paymentQuery, paymentID, contract.ID, contract.OwnerID, int(contract.StartDate.Month()), contract.StartDate.Year(), pRent, pElec, pWater, pOther, 0.0, "", "unpaid", dueDate, notes)
	if err != nil {
		return err
	}

	if contract.RoomID != nil {
		_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, contract.RoomID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *ContractRepository) FindAll(ctx context.Context, ownerID uuid.UUID, status string) ([]model.Contract, error) {
	query := `
		SELECT 
			c.id, c.room_id, c.user_id, c.owner_id, c.start_date, c.end_date, c.rental_duration,
			c.monthly_rent, c.total_price, COALESCE(c.deposit, 0), COALESCE(c.payment_due_day, 1), c.status, COALESCE(c.notes, ''), COALESCE(c.payment_interval, 'monthly'), c.created_at,
			r.room_number, r.price_per_month, r.status,
			u.name, u.phone, u.ktp_url, u.selfie_url,
			(SELECT status FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_status,
			(SELECT (amount_rent + amount_electricity + amount_water + amount_other) FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_amount
		FROM contracts c
		LEFT JOIN rooms r ON c.room_id = r.id
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.owner_id = $1
	`
	args := []interface{}{ownerID}

	if status != "" && status != "all" {
		query += fmt.Sprintf(` AND c.status = $%d`, len(args)+1)
		args = append(args, status)
	}

	query += ` ORDER BY c.created_at DESC`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []model.Contract
	for rows.Next() {
		var c model.Contract
		var roomNum, roomStatus, uName, uPhone, uKtp, uSelfie *string
		var roomPrice *float64
		
		err := rows.Scan(
			&c.ID, &c.RoomID, &c.UserID, &c.OwnerID, &c.StartDate, &c.EndDate, &c.RentalDuration,
			&c.MonthlyRent, &c.TotalPrice, &c.Deposit, &c.PaymentDueDay, &c.Status, &c.Notes, &c.PaymentInterval, &c.CreatedAt,
			&roomNum, &roomPrice, &roomStatus,
			&uName, &uPhone, &uKtp, &uSelfie,
			&c.LatestPaymentStatus, &c.LatestPaymentAmount,
		)
		if err != nil {
			return nil, err
		}

		if c.RoomID != nil && roomNum != nil {
			c.Room = &model.Room{
				ID:            *c.RoomID,
				RoomNumber:    *roomNum,
				PricePerMonth: *roomPrice,
				Status:        *roomStatus,
			}
		}

		if c.UserID != nil && uName != nil {
			c.User = &model.User{
				ID:        *c.UserID,
				Name:      *uName,
				Phone:     *uPhone,
				KtpURL:    uKtp,
				SelfieURL: uSelfie,
			}
		}

		contracts = append(contracts, c)
	}
	return contracts, nil
}

func (r *ContractRepository) FindByID(ctx context.Context, id uuid.UUID, ownerID uuid.UUID) (*model.Contract, error) {
	query := `
		SELECT 
			c.id, c.room_id, c.user_id, c.owner_id, c.start_date, c.end_date, c.rental_duration,
			c.monthly_rent, c.total_price, COALESCE(c.deposit, 0), COALESCE(c.payment_due_day, 1), c.status, COALESCE(c.notes, ''), COALESCE(c.payment_interval, 'monthly'), c.created_at,
			r.room_number, r.price_per_month, r.status,
			u.name, u.phone, u.ktp_url, u.selfie_url,
			(SELECT status FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_status,
			(SELECT (amount_rent + amount_electricity + amount_water + amount_other) FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_amount
		FROM contracts c
		LEFT JOIN rooms r ON c.room_id = r.id
		LEFT JOIN users u ON c.user_id = u.id
		WHERE c.id = $1 AND c.owner_id = $2
	`
	
	var c model.Contract
	var roomNum, roomStatus, uName, uPhone, uKtp, uSelfie *string
	var roomPrice *float64

	err := r.db.QueryRow(ctx, query, id, ownerID).Scan(
		&c.ID, &c.RoomID, &c.UserID, &c.OwnerID, &c.StartDate, &c.EndDate, &c.RentalDuration,
		&c.MonthlyRent, &c.TotalPrice, &c.Deposit, &c.PaymentDueDay, &c.Status, &c.Notes, &c.PaymentInterval, &c.CreatedAt,
		&roomNum, &roomPrice, &roomStatus,
		&uName, &uPhone, &uKtp, &uSelfie,
		&c.LatestPaymentStatus, &c.LatestPaymentAmount,
	)
	
	if err != nil {
		return nil, err
	}

	if c.RoomID != nil && roomNum != nil {
		c.Room = &model.Room{
			ID:            *c.RoomID,
			RoomNumber:    *roomNum,
			PricePerMonth: *roomPrice,
			Status:        *roomStatus,
		}
	}

	if c.UserID != nil && uName != nil {
		c.User = &model.User{
			ID:        *c.UserID,
			Name:      *uName,
			Phone:     *uPhone,
			KtpURL:    uKtp,
			SelfieURL: uSelfie,
		}
	}

	return &c, nil
}

func (r *ContractRepository) Update(ctx context.Context, contract *model.Contract) error {
	query := `UPDATE contracts 
	          SET start_date = $1, end_date = $2, rental_duration = $3, monthly_rent = $4, deposit = $5, payment_due_day = $6, status = $7, notes = $8 
	          WHERE id = $9 AND owner_id = $10`
	_, err := r.db.Exec(ctx, query, contract.StartDate, contract.EndDate, contract.RentalDuration, contract.MonthlyRent, contract.Deposit, contract.PaymentDueDay, contract.Status, contract.Notes, contract.ID, contract.OwnerID)
	return err
}

func (r *ContractRepository) Delete(ctx context.Context, id uuid.UUID, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var roomID, userID *uuid.UUID
	err = tx.QueryRow(ctx, `SELECT room_id, user_id FROM contracts WHERE id = $1 AND owner_id = $2`, id, ownerID).Scan(&roomID, &userID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `DELETE FROM contracts WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return err
	}

	if roomID != nil {
		_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'available' WHERE id = $1`, roomID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
