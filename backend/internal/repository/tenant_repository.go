package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TenantRepository struct {
	db *pgxpool.Pool
}

func NewTenantRepository(db *pgxpool.Pool) *TenantRepository {
	return &TenantRepository{db: db}
}

func (r *TenantRepository) Create(ctx context.Context, tenant *model.Tenant, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `INSERT INTO tenants (room_id, name, phone, ktp_url, selfie_url) 
	          VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`
	err = tx.QueryRow(ctx, query, tenant.RoomID, tenant.Name, tenant.Phone, tenant.KTPURL, tenant.SelfieURL).
		Scan(&tenant.ID, &tenant.CreatedAt)
	if err != nil {
		return err
	}

	if tenant.RoomID != nil {
		_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", tenant.RoomID)
		if err != nil {
			return err
		}

		// Get room price
		var price float64
		err = tx.QueryRow(ctx, "SELECT price_per_month FROM rooms WHERE id = $1", tenant.RoomID).Scan(&price)
		if err == nil {
			startDate := tenant.Contract.StartDate
			rentalDuration := tenant.Contract.RentalDuration
			endDate := startDate.AddDate(0, rentalDuration, 0)
			dueDate := startDate.AddDate(0, 1, -3)
			paymentDueDay := dueDate.Day()
			notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
			totalPrice := price * float64(rentalDuration)

			contractQuery := `INSERT INTO contracts (room_id, tenant_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes) 
							  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
			_, err = tx.Exec(ctx, contractQuery, tenant.RoomID, tenant.ID, ownerID, startDate, endDate, rentalDuration, price, totalPrice, 0, paymentDueDay, "active", notes)
			if err != nil {
				return err
			}
		}
	}
	
	return tx.Commit(ctx)
}

func (r *TenantRepository) FindAll(ctx context.Context) ([]model.Tenant, error) {
	query := `SELECT t.id, t.room_id, t.name, t.phone, t.ktp_url, t.selfie_url, t.created_at,
	          r.room_number, r.status,
	          c.start_date, c.end_date, c.rental_duration, c.status
	          FROM tenants t
	          LEFT JOIN rooms r ON t.room_id = r.id
	          LEFT JOIN contracts c ON t.id = c.tenant_id AND c.status = 'active'
	          ORDER BY t.created_at DESC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []model.Tenant
	for rows.Next() {
		var t model.Tenant
		var roomNum *string
		var roomStatus *string
		var startDate, endDate *time.Time
		var rentalDuration *int
		var contractStatus *string
		err := rows.Scan(&t.ID, &t.RoomID, &t.Name, &t.Phone, &t.KTPURL, &t.SelfieURL, &t.CreatedAt, 
			&roomNum, &roomStatus, &startDate, &endDate, &rentalDuration, &contractStatus)
		if err != nil {
			return nil, err
		}
		if roomNum != nil {
			t.Room = &model.Room{RoomNumber: *roomNum, Status: *roomStatus}
		}
		if startDate != nil {
			t.Contract = &model.Contract{
				StartDate: *startDate,
				EndDate: *endDate,
				RentalDuration: *rentalDuration,
				Status: *contractStatus,
			}
		}
		tenants = append(tenants, t)
	}
	return tenants, nil
}

func (r *TenantRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Tenant, error) {
	query := `SELECT t.id, t.room_id, t.name, t.phone, t.ktp_url, t.selfie_url, t.created_at,
	          r.room_number, r.price_per_month, r.description, r.status,
	          c.start_date, c.end_date, c.rental_duration, c.status
	          FROM tenants t
	          LEFT JOIN rooms r ON t.room_id = r.id
	          LEFT JOIN contracts c ON t.id = c.tenant_id AND c.status = 'active'
	          WHERE t.id = $1`
	t := &model.Tenant{}
	var roomNum, roomDesc, roomStatus *string
	var roomPrice *float64
	var startDate, endDate *time.Time
	var rentalDuration *int
	var contractStatus *string
	
	err := r.db.QueryRow(ctx, query, id).Scan(
		&t.ID, &t.RoomID, &t.Name, &t.Phone, &t.KTPURL, &t.SelfieURL, &t.CreatedAt,
		&roomNum, &roomPrice, &roomDesc, &roomStatus,
		&startDate, &endDate, &rentalDuration, &contractStatus,
	)
	if err != nil {
		return nil, err
	}

	if roomNum != nil {
		t.Room = &model.Room{
			ID: *t.RoomID,
			RoomNumber: *roomNum,
			PricePerMonth: *roomPrice,
			Description: *roomDesc,
			Status: *roomStatus,
		}
	}
	if startDate != nil {
		t.Contract = &model.Contract{
			StartDate: *startDate,
			EndDate: *endDate,
			RentalDuration: *rentalDuration,
			Status: *contractStatus,
		}
	}
	return t, nil
}

func (r *TenantRepository) Update(ctx context.Context, tenant *model.Tenant) error {
	oldTenant, _ := r.FindByID(ctx, tenant.ID)
	query := `UPDATE tenants SET room_id = $1, name = $2, phone = $3, ktp_url = $4, selfie_url = $5 WHERE id = $6`
	_, err := r.db.Exec(ctx, query, tenant.RoomID, tenant.Name, tenant.Phone, tenant.KTPURL, tenant.SelfieURL, tenant.ID)
	if err == nil && oldTenant != nil && oldTenant.RoomID != nil && tenant.RoomID != nil {
		if oldTenant.RoomID.String() != tenant.RoomID.String() {
			_, _ = r.db.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", oldTenant.RoomID)
			_, _ = r.db.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", tenant.RoomID)
		}
	}
	return err
}

func (r *TenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	t, _ := r.FindByID(ctx, id)
	query := `DELETE FROM tenants WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	if err == nil {
		_, _ = r.db.Exec(ctx, `DELETE FROM contracts WHERE tenant_id = $1`, id)
		if t != nil && t.RoomID != nil {
			_, _ = r.db.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", t.RoomID)
		}
	}
	return err
}
