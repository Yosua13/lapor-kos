package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ContractRepository struct {
	db *pgxpool.Pool
}

func NewContractRepository(db *pgxpool.Pool) *ContractRepository {
	return &ContractRepository{db: db}
}

// Create validates every relation in the selected property in the same
// transaction. A client supplied room ID is never accepted as proof that the
// room belongs to the current property.
func (r *ContractRepository) Create(ctx context.Context, propertyID, actorID uuid.UUID, contract *model.Contract) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if contract.RoomID == nil || contract.UserID == nil {
		return fmt.Errorf("room and tenant are required")
	}

	var roomStatus string
	if err := tx.QueryRow(ctx,
		`SELECT status FROM rooms WHERE id = $1 AND property_id = $2 FOR UPDATE`,
		*contract.RoomID, propertyID,
	).Scan(&roomStatus); err != nil {
		return err
	}
	if roomStatus != "available" {
		return fmt.Errorf("kamar tidak tersedia (status: %s)", roomStatus)
	}

	var tenantExists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM users WHERE id = $1 AND is_active = TRUE)`,
		*contract.UserID,
	).Scan(&tenantExists); err != nil {
		return err
	}
	if !tenantExists {
		return pgx.ErrNoRows
	}

	if contract.PaymentInterval == "" {
		contract.PaymentInterval = "monthly"
	}
	if contract.Status == "" {
		contract.Status = "active"
	}
	contract.PropertyID = propertyID
	contract.OwnerID = actorID // legacy compatibility only; never authorization.

	err = tx.QueryRow(ctx, `
		INSERT INTO contracts (
			property_id, room_id, user_id, owner_id, start_date, end_date,
			rental_duration, monthly_rent, total_price, deposit,
			payment_due_day, status, notes, electricity_bill, water_bill,
			other_bills, payment_interval
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17
		)
		RETURNING id, created_at`,
		propertyID, contract.RoomID, contract.UserID, actorID,
		contract.StartDate, contract.EndDate, contract.RentalDuration,
		contract.MonthlyRent, contract.TotalPrice, contract.Deposit,
		contract.PaymentDueDay, contract.Status, contract.Notes,
		contract.ElectricityBill, contract.WaterBill, contract.OtherBills,
		contract.PaymentInterval,
	).Scan(&contract.ID, &contract.CreatedAt)
	if err != nil {
		return err
	}

	dueDate := contract.StartDate.AddDate(0, 1, -3)
	notes := contract.Notes
	if notes == "" {
		notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", contract.PaymentDueDay)
	}
	pRent, pElectricity, pWater, pOther := initialBillAmounts(contract)
	_, err = tx.Exec(ctx, `
		INSERT INTO payments (
			id, property_id, contract_id, owner_id, period_month, period_year,
			amount_rent, amount_electricity, amount_water, amount_other,
			total_paid, payment_method, status, due_date, notes
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'','unpaid',$11,$12)
		ON CONFLICT (contract_id, period_month, period_year) DO NOTHING`,
		uuid.New(), propertyID, contract.ID, actorID,
		int(contract.StartDate.Month()), contract.StartDate.Year(), pRent,
		pElectricity, pWater, pOther, dueDate, notes,
	)
	if err != nil {
		return err
	}

	command, err := tx.Exec(ctx,
		`UPDATE rooms SET status = 'occupied' WHERE id = $1 AND property_id = $2`,
		*contract.RoomID, propertyID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}

	return tx.Commit(ctx)
}

func initialBillAmounts(contract *model.Contract) (rent, electricity, water, other float64) {
	if contract.PaymentInterval == "per_contract" {
		duration := float64(contract.RentalDuration)
		return contract.MonthlyRent * duration,
			contract.ElectricityBill * duration,
			contract.WaterBill * duration,
			(contract.OtherBills * duration) + contract.Deposit
	}
	return contract.MonthlyRent, contract.ElectricityBill, contract.WaterBill,
		contract.OtherBills + contract.Deposit
}

func (r *ContractRepository) FindAll(ctx context.Context, propertyID uuid.UUID, status string) ([]model.Contract, error) {
	query := contractSelect + ` WHERE c.property_id = $1`
	args := []any{propertyID}
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

	contracts := make([]model.Contract, 0)
	for rows.Next() {
		contract, err := scanContract(rows)
		if err != nil {
			return nil, err
		}
		contracts = append(contracts, *contract)
	}
	return contracts, rows.Err()
}

func (r *ContractRepository) FindByID(ctx context.Context, propertyID, id uuid.UUID) (*model.Contract, error) {
	return scanContract(r.db.QueryRow(ctx, contractSelect+`
		WHERE c.property_id = $1 AND c.id = $2`, propertyID, id))
}

func (r *ContractRepository) Update(ctx context.Context, propertyID uuid.UUID, contract *model.Contract) error {
	command, err := r.db.Exec(ctx, `
		UPDATE contracts SET
			start_date=$1, end_date=$2, rental_duration=$3, monthly_rent=$4,
			deposit=$5, payment_due_day=$6, status=$7, notes=$8,
			payment_interval=$9
		WHERE id=$10 AND property_id=$11`,
		contract.StartDate, contract.EndDate, contract.RentalDuration,
		contract.MonthlyRent, contract.Deposit, contract.PaymentDueDay,
		contract.Status, contract.Notes, contract.PaymentInterval,
		contract.ID, propertyID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *ContractRepository) Delete(ctx context.Context, propertyID, id uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var roomID *uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT room_id FROM contracts
		WHERE id = $1 AND property_id = $2 FOR UPDATE`, id, propertyID,
	).Scan(&roomID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM contracts WHERE id = $1 AND property_id = $2`, id, propertyID,
	); err != nil {
		return err
	}
	if roomID != nil {
		if _, err := tx.Exec(ctx,
			`UPDATE rooms SET status='available' WHERE id=$1 AND property_id=$2`,
			*roomID, propertyID,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

const contractSelect = `
	SELECT
		c.id, c.property_id, c.room_id, c.user_id, c.owner_id,
		c.start_date, c.end_date, c.rental_duration, c.monthly_rent,
		c.total_price, COALESCE(c.deposit,0), COALESCE(c.electricity_bill,0),
		COALESCE(c.water_bill,0), COALESCE(c.other_bills,0),
		COALESCE(c.payment_interval,'monthly'), COALESCE(c.payment_due_day,1),
		c.status, COALESCE(c.notes,''), c.created_at,
		r.room_number, r.price_per_month, r.status,
		u.name, u.phone, u.ktp_url, u.selfie_url,
		(SELECT p.status FROM payments p
		 WHERE p.contract_id=c.id AND p.property_id=c.property_id
		 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1),
		(SELECT p.amount_rent+p.amount_electricity+p.amount_water+p.amount_other
		 FROM payments p WHERE p.contract_id=c.id AND p.property_id=c.property_id
		 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1)
	FROM contracts c
	LEFT JOIN rooms r ON r.id=c.room_id AND r.property_id=c.property_id
	LEFT JOIN users u ON u.id=c.user_id`

type contractRow interface {
	Scan(dest ...any) error
}

func scanContract(row contractRow) (*model.Contract, error) {
	var contract model.Contract
	var roomNumber, roomStatus, userName, userPhone, ktpURL, selfieURL *string
	var roomPrice *float64
	err := row.Scan(
		&contract.ID, &contract.PropertyID, &contract.RoomID, &contract.UserID,
		&contract.OwnerID, &contract.StartDate, &contract.EndDate,
		&contract.RentalDuration, &contract.MonthlyRent, &contract.TotalPrice,
		&contract.Deposit, &contract.ElectricityBill, &contract.WaterBill,
		&contract.OtherBills, &contract.PaymentInterval, &contract.PaymentDueDay,
		&contract.Status, &contract.Notes, &contract.CreatedAt,
		&roomNumber, &roomPrice, &roomStatus, &userName, &userPhone, &ktpURL,
		&selfieURL, &contract.LatestPaymentStatus, &contract.LatestPaymentAmount,
	)
	if err != nil {
		return nil, err
	}
	if contract.RoomID != nil && roomNumber != nil && roomPrice != nil && roomStatus != nil {
		contract.Room = &model.Room{
			ID: *contract.RoomID, PropertyID: contract.PropertyID,
			RoomNumber: *roomNumber, PricePerMonth: *roomPrice, Status: *roomStatus,
		}
	}
	if contract.UserID != nil && userName != nil {
		contract.User = &model.User{ID: *contract.UserID, Name: *userName}
		if userPhone != nil {
			contract.User.Phone = *userPhone
		}
		contract.User.KtpURL = ktpURL
		contract.User.SelfieURL = selfieURL
	}
	return &contract, nil
}
