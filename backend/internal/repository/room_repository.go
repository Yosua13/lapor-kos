package repository

import (
	"context"

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

func (r *RoomRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM rooms WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}
