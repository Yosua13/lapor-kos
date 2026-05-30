package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoomRepository struct {
	db *pgxpool.Pool
}

func NewRoomRepository(db *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{db: db}
}

func (r *RoomRepository) Create(ctx context.Context, room *model.Room) error {
	query := `INSERT INTO rooms (room_number, price_per_month, description, status) 
	          VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	return r.db.QueryRow(ctx, query, room.RoomNumber, room.PricePerMonth, room.Description, room.Status).
		Scan(&room.ID, &room.CreatedAt)
}

func (r *RoomRepository) CreateWithTenant(ctx context.Context, room *model.Room, tenant *model.Tenant, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	roomQuery := `INSERT INTO rooms (room_number, price_per_month, description, status) 
	              VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	err = tx.QueryRow(ctx, roomQuery, room.RoomNumber, room.PricePerMonth, room.Description, room.Status).
		Scan(&room.ID, &room.CreatedAt)
	if err != nil {
		return err
	}

	tenant.RoomID = &room.ID
	tenantQuery := `INSERT INTO tenants (room_id, name, phone, ktp_url, selfie_url) 
	                VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`
	err = tx.QueryRow(ctx, tenantQuery, tenant.RoomID, tenant.Name, tenant.Phone, tenant.KTPURL, tenant.SelfieURL).
		Scan(&tenant.ID, &tenant.CreatedAt)
	if err != nil {
		return err
	}

	// Create a contract for this tenant and room
	contractQuery := `INSERT INTO contracts (room_id, tenant_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes) 
	                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	
	startDate := tenant.Contract.StartDate
	rentalDuration := tenant.Contract.RentalDuration
	endDate := startDate.AddDate(0, rentalDuration, 0)
	dueDate := startDate.AddDate(0, 1, -3)
	paymentDueDay := dueDate.Day()
	notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
	totalPrice := room.PricePerMonth * float64(rentalDuration)
	
	_, err = tx.Exec(ctx, contractQuery, room.ID, tenant.ID, ownerID, startDate, endDate, rentalDuration, room.PricePerMonth, totalPrice, 0, paymentDueDay, "active", notes)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *RoomRepository) FindAll(ctx context.Context) ([]model.Room, error) {
	query := `SELECT id, room_number, price_per_month, description, status, created_at FROM rooms ORDER BY room_number ASC`
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []model.Room
	for rows.Next() {
		var room model.Room
		err := rows.Scan(&room.ID, &room.RoomNumber, &room.PricePerMonth, &room.Description, &room.Status, &room.CreatedAt)
		if err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}
	return rooms, nil
}

func (r *RoomRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.Room, error) {
	query := `SELECT id, room_number, price_per_month, description, status, created_at FROM rooms WHERE id = $1`
	room := &model.Room{}
	err := r.db.QueryRow(ctx, query, id).Scan(&room.ID, &room.RoomNumber, &room.PricePerMonth, &room.Description, &room.Status, &room.CreatedAt)
	if err != nil {
		return nil, err
	}
	return room, nil
}

func (r *RoomRepository) Update(ctx context.Context, room *model.Room) error {
	query := `UPDATE rooms SET room_number = $1, price_per_month = $2, description = $3, status = $4 WHERE id = $5`
	_, err := r.db.Exec(ctx, query, room.RoomNumber, room.PricePerMonth, room.Description, room.Status, room.ID)
	return err
}

func (r *RoomRepository) Delete(ctx context.Context, id uuid.UUID, deleteTenant bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if deleteTenant {
		_, err = tx.Exec(ctx, `DELETE FROM tenants WHERE room_id = $1`, id)
	} else {
		_, err = tx.Exec(ctx, `UPDATE tenants SET room_id = NULL WHERE room_id = $1`, id)
	}
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `DELETE FROM contracts WHERE room_id = $1`, id)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
