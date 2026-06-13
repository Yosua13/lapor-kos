package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
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

func (r *RoomRepository) CreateWithTenant(ctx context.Context, room *model.Room, user *model.User, contract *model.Contract, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Create Room
	roomQuery := `INSERT INTO rooms (room_number, price_per_month, description, status) 
	              VALUES ($1, $2, $3, $4) RETURNING id, created_at`
	err = tx.QueryRow(ctx, roomQuery, room.RoomNumber, room.PricePerMonth, room.Description, room.Status).
		Scan(&room.ID, &room.CreatedAt)
	if err != nil {
		return err
	}

	// 2. Find or Create User
	var userID uuid.UUID
	if user.Email != "" {
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", user.Email).Scan(&userID)
		if err != nil {
			pass := user.Phone
			if pass == "" {
				pass = "password123"
			}
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			userID = uuid.New()
			userQuery := `INSERT INTO users (id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url) 
			              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
			err = tx.QueryRow(ctx, userQuery, userID, user.Name, user.Email, string(hashedPassword), "tenant", true, user.Phone, user.KtpURL, user.SelfieURL).Scan(&userID)
			if err != nil {
				return err
			}
		} else {
			// Update ktp/selfie/phone if provided
			updateQ := `UPDATE users SET phone = COALESCE(NULLIF($1, ''), phone), ktp_url = COALESCE($2, ktp_url), selfie_url = COALESCE($3, selfie_url) WHERE id = $4`
			_, err = tx.Exec(ctx, updateQ, user.Phone, user.KtpURL, user.SelfieURL, userID)
			if err != nil {
				return err
			}
		}
	} else {
		return fmt.Errorf("email is required")
	}

	// 3. Create Contract
	contractQuery := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes) 
	                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	
	startDate := contract.StartDate
	rentalDuration := contract.RentalDuration
	endDate := startDate.AddDate(0, rentalDuration, 0)
	dueDate := startDate.AddDate(0, 1, -3)
	paymentDueDay := dueDate.Day()
	notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
	
	_, err = tx.Exec(ctx, contractQuery, room.ID, userID, ownerID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, paymentDueDay, "active", notes)
	if err != nil {
		return err
	}

	// 4. Update Room Status to Occupied
	_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, room.ID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}


func (r *RoomRepository) AssignTenant(ctx context.Context, roomID uuid.UUID, user *model.User, contract *model.Contract, ownerID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var userID uuid.UUID
	if user.Email != "" {
		err = tx.QueryRow(ctx, "SELECT id FROM users WHERE email = $1", user.Email).Scan(&userID)
		if err != nil {
			pass := user.Phone
			if pass == "" {
				pass = "password123"
			}
			hashedPassword, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
			if err != nil {
				return err
			}
			userID = uuid.New()
			userQuery := `INSERT INTO users (id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url) 
			              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`
			err = tx.QueryRow(ctx, userQuery, userID, user.Name, user.Email, string(hashedPassword), "tenant", true, user.Phone, user.KtpURL, user.SelfieURL).Scan(&userID)
			if err != nil {
				return err
			}
		} else {
            // Update ktp/selfie/phone if provided
            updateQ := `UPDATE users SET phone = COALESCE(NULLIF($1, ''), phone), ktp_url = COALESCE($2, ktp_url), selfie_url = COALESCE($3, selfie_url) WHERE id = $4`
            _, err = tx.Exec(ctx, updateQ, user.Phone, user.KtpURL, user.SelfieURL, userID)
            if err != nil {
                return err
            }
        }
	} else {
		return fmt.Errorf("email is required")
	}

	contractQuery := `INSERT INTO contracts (room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes) 
	                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	
	startDate := contract.StartDate
	rentalDuration := contract.RentalDuration
	endDate := startDate.AddDate(0, rentalDuration, 0)
	dueDate := startDate.AddDate(0, 1, -3)
	paymentDueDay := dueDate.Day()
	notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
	
	_, err = tx.Exec(ctx, contractQuery, roomID, userID, ownerID, startDate, endDate, rentalDuration, contract.MonthlyRent, contract.TotalPrice, contract.Deposit, paymentDueDay, "active", notes)
	if err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `UPDATE rooms SET status = 'occupied' WHERE id = $1`, roomID)
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

func (r *RoomRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM rooms WHERE id = $1`, id)
	return err
}
