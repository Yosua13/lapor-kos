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

// Create persists a draft and its first immutable snapshot. Availability is
// checked again under lock during activation, so creating a draft never
// reserves a room or creates a financial transaction.
func (r *ContractRepository) Create(ctx context.Context, propertyID, actorID uuid.UUID, contract *model.Contract) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	if contract.RoomID == nil || contract.UserID == nil {
		return fmt.Errorf("room and tenant are required")
	}

	var roomExists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM rooms WHERE id = $1 AND property_id = $2)`,
		*contract.RoomID, propertyID,
	).Scan(&roomExists); err != nil {
		return err
	}
	if !roomExists {
		return pgx.ErrNoRows
	}

	var tenantExists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM tenant_profiles
			WHERE property_id=$1 AND user_id=$2 AND status='active'
		)`, propertyID, *contract.UserID,
	).Scan(&tenantExists); err != nil {
		return err
	}
	if !tenantExists {
		return pgx.ErrNoRows
	}

	if contract.PaymentInterval == "" {
		contract.PaymentInterval = "monthly"
	}
	contract.Status = model.ContractDraft
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
		RETURNING id, created_at, updated_at`,
		propertyID, contract.RoomID, contract.UserID, actorID,
		contract.StartDate, contract.EndDate, contract.RentalDuration,
		contract.MonthlyRent, contract.TotalPrice, contract.Deposit,
		contract.PaymentDueDay, contract.Status, contract.Notes,
		contract.ElectricityBill, contract.WaterBill, contract.OtherBills,
		contract.PaymentInterval,
	).Scan(&contract.ID, &contract.CreatedAt, &contract.UpdatedAt)
	if err != nil {
		return err
	}

	var versionID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO contract_versions (property_id,contract_id,version_number,snapshot,reason,created_by)
		SELECT property_id,id,1,jsonb_build_object(
			'contract_id',id,'property_id',property_id,'room_id',room_id,'user_id',user_id,
			'start_date',start_date,'end_date',end_date,'rental_duration',rental_duration,
			'monthly_rent',monthly_rent,'total_price',total_price,'deposit',deposit,
			'electricity_bill',electricity_bill,'water_bill',water_bill,'other_bills',other_bills,
			'payment_interval',payment_interval,'payment_due_day',payment_due_day,'notes',notes
		),'Draft kontrak dibuat',$3 FROM contracts WHERE property_id=$1 AND id=$2 RETURNING id`,
		propertyID, contract.ID, actorID,
	).Scan(&versionID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET current_version_id=$1 WHERE property_id=$2 AND id=$3`, versionID, propertyID, contract.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events
		(property_id,contract_id,version_id,event_type,to_status,reason,actor_id)
		VALUES ($1,$2,$3,'created','draft','Draft kontrak dibuat',$4)`, propertyID, contract.ID, versionID, actorID); err != nil {
		return err
	}
	contract.CurrentVersionID = &versionID

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
	return fmt.Errorf("%w: gunakan amendment atau transition lifecycle", ErrContractHistoryImmutable)
}

func (r *ContractRepository) Delete(ctx context.Context, propertyID, id uuid.UUID) error {
	return fmt.Errorf("%w: histori kontrak tidak boleh dihapus", ErrContractHistoryImmutable)
}

const contractSelect = `
	SELECT
		c.id, c.property_id, c.room_id, c.user_id, c.owner_id,
		c.start_date, c.end_date, c.rental_duration, c.monthly_rent,
		c.total_price, COALESCE(c.deposit,0), COALESCE(c.electricity_bill,0),
		COALESCE(c.water_bill,0), COALESCE(c.other_bills,0),
		COALESCE(c.payment_interval,'monthly'), COALESCE(c.payment_due_day,1),
		c.status, COALESCE(c.notes,''), c.created_at,
		c.updated_at,c.current_version_id,c.renewed_from_contract_id,
		r.room_number, r.price_per_month, r.status,
		COALESCE(NULLIF(tp.full_name,''),u.name),COALESCE(NULLIF(tp.phone,''),u.phone),NULL::text,NULL::text,
		(SELECT p.status FROM payments p
		 WHERE p.contract_id=c.id AND p.property_id=c.property_id
		 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1),
		(SELECT p.amount_rent+p.amount_electricity+p.amount_water+p.amount_other
		 FROM payments p WHERE p.contract_id=c.id AND p.property_id=c.property_id
		 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1)
	FROM contracts c
	LEFT JOIN rooms r ON r.id=c.room_id AND r.property_id=c.property_id
	LEFT JOIN users u ON u.id=c.user_id
	LEFT JOIN tenant_profiles tp ON tp.property_id=c.property_id AND tp.user_id=c.user_id`

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
		&contract.UpdatedAt, &contract.CurrentVersionID, &contract.RenewedFromContractID,
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
