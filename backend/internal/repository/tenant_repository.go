package repository

import (
	"context"

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

func (r *TenantRepository) Create(ctx context.Context, tenant *model.Tenant) error {
	query := `INSERT INTO tenants (room_id, name, phone, ktp_url, selfie_url, entry_date, rental_duration) 
	          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`
	err := r.db.QueryRow(ctx, query, tenant.RoomID, tenant.Name, tenant.Phone, tenant.KTPURL, tenant.SelfieURL, tenant.EntryDate, tenant.RentalDuration).
		Scan(&tenant.ID, &tenant.CreatedAt)
	if err == nil && tenant.RoomID != nil {
		_, _ = r.db.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", tenant.RoomID)
	}
	return err
}

func (r *TenantRepository) FindAll(ctx context.Context) ([]model.Tenant, error) {
	query := `SELECT t.id, t.room_id, t.name, t.phone, t.ktp_url, t.selfie_url, t.entry_date, t.rental_duration, t.created_at,
	          r.room_number, r.status
	          FROM tenants t
	          LEFT JOIN rooms r ON t.room_id = r.id
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
		err := rows.Scan(&t.ID, &t.RoomID, &t.Name, &t.Phone, &t.KTPURL, &t.SelfieURL, &t.EntryDate, &t.RentalDuration, &t.CreatedAt, &roomNum, &roomStatus)
		if err != nil {
			return nil, err
		}
		if roomNum != nil {
			t.Room = &model.Room{RoomNumber: *roomNum, Status: *roomStatus}
		}
		tenants = append(tenants, t)
	}
	return tenants, nil
}

func (r *TenantRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Tenant, error) {
	query := `SELECT id, room_id, name, phone, ktp_url, selfie_url, entry_date, rental_duration, created_at FROM tenants WHERE id = $1`
	t := &model.Tenant{}
	err := r.db.QueryRow(ctx, query, id).Scan(&t.ID, &t.RoomID, &t.Name, &t.Phone, &t.KTPURL, &t.SelfieURL, &t.EntryDate, &t.RentalDuration, &t.CreatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *TenantRepository) Update(ctx context.Context, tenant *model.Tenant) error {
	oldTenant, _ := r.FindByID(ctx, tenant.ID)
	query := `UPDATE tenants SET room_id = $1, name = $2, phone = $3, ktp_url = $4, selfie_url = $5, entry_date = $6, rental_duration = $7 WHERE id = $8`
	_, err := r.db.Exec(ctx, query, tenant.RoomID, tenant.Name, tenant.Phone, tenant.KTPURL, tenant.SelfieURL, tenant.EntryDate, tenant.RentalDuration, tenant.ID)
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
	if err == nil && t != nil && t.RoomID != nil {
		_, _ = r.db.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", t.RoomID)
	}
	return err
}
