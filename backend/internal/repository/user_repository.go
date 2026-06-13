package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepo interface {
	Create(ctx context.Context, user *model.User) error
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	FindByVerificationToken(ctx context.Context, token string) (*model.User, error)
	VerifyUser(ctx context.Context, id uuid.UUID) error
	SetOTP(ctx context.Context, email string, code string, expiresAt time.Time) error
	ResetPassword(ctx context.Context, email string, newPasswordHash string) error
	UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error
	UpdateProfile(ctx context.Context, id uuid.UUID, name string, email string, phone string) error
	UpdatePassword(ctx context.Context, id uuid.UUID, newPasswordHash string) error
	GetTenantProfile(ctx context.Context, id uuid.UUID) (map[string]interface{}, error)
	UpdateTenantProfile(ctx context.Context, id uuid.UUID, name string, phone string, roomIDStr string, entryDateStr string, rentalDuration int, ktpURL *string, selfieURL *string) error
	DeleteTenant(ctx context.Context, id uuid.UUID) error
}

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	query := `INSERT INTO users (name, email, password_hash, role, verification_token, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	return r.db.QueryRow(ctx, query, user.Name, user.Email, user.PasswordHash, user.Role, user.VerificationToken, user.Phone).Scan(&user.ID, &user.CreatedAt)
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, verification_token, otp_code, otp_expires_at, whatsapp_group_link, phone, ktp_url, selfie_url, created_at FROM users WHERE email = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role,
		&user.IsVerified, &user.VerificationToken, &user.OTPCode, &user.OTPExpiresAt, &user.WhatsAppGroupLink, &user.Phone, &user.KtpURL, &user.SelfieURL, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, whatsapp_group_link, phone, ktp_url, selfie_url, created_at FROM users WHERE id = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.WhatsAppGroupLink, &user.Phone, &user.KtpURL, &user.SelfieURL, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByVerificationToken(ctx context.Context, token string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url, created_at FROM users WHERE verification_token = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, token).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.Phone, &user.KtpURL, &user.SelfieURL, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) VerifyUser(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *UserRepository) SetOTP(ctx context.Context, email string, code string, expiresAt time.Time) error {
	query := `UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3`
	_, err := r.db.Exec(ctx, query, code, expiresAt, email)
	return err
}

func (r *UserRepository) ResetPassword(ctx context.Context, email string, newPasswordHash string) error {
	query := `UPDATE users SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL WHERE email = $2`
	_, err := r.db.Exec(ctx, query, newPasswordHash, email)
	return err
}

func (r *UserRepository) UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error {
	query := `UPDATE users SET whatsapp_group_link = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, link, id)
	return err
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id uuid.UUID, name string, email string, phone string) error {
	// Update users table
	queryUser := `UPDATE users SET name = $1, email = $2, phone = $3 WHERE id = $4`
	_, err := r.db.Exec(ctx, queryUser, name, email, phone, id)
	return err
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, newPasswordHash string) error {
	query := `UPDATE users SET password_hash = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, newPasswordHash, id)
	return err
}

func (r *UserRepository) GetTenantProfile(ctx context.Context, userID uuid.UUID) (map[string]interface{}, error) {
	query := `
		SELECT 
			u.id, u.name, u.email, u.phone, u.ktp_url, u.selfie_url, u.created_at,
			c.id as contract_id, c.start_date, c.end_date, c.rental_duration, c.monthly_rent, c.total_price, c.deposit, c.payment_due_day, c.status as contract_status, c.notes as contract_notes,
			r.id as room_id, r.room_number, r.price_per_month, r.description, r.status as room_status,
			(SELECT status FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_status,
			(SELECT (amount_rent + amount_electricity + amount_water + amount_other) FROM payments WHERE contract_id = c.id ORDER BY period_year DESC, period_month DESC, due_date DESC LIMIT 1) AS latest_payment_amount
		FROM users u
		LEFT JOIN contracts c ON c.user_id = u.id AND c.status = 'active'
		LEFT JOIN rooms r ON c.room_id = r.id
		WHERE u.id = $1
		LIMIT 1
	`
	
	var uID uuid.UUID
	var name, email, phone string
	var ktpURL, selfieURL *string
	var createdAt time.Time
	
	var contractID, roomID *uuid.UUID
	var startDate, endDate *time.Time
	var rentalDuration, paymentDueDay *int
	var monthlyRent, totalPrice, deposit *float64
	var contractStatus, contractNotes *string
	var roomNumber, roomDescription, roomStatus *string
	var roomPrice *float64
	var latestPaymentStatus *string
	var latestPaymentAmount *float64

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&uID, &name, &email, &phone, &ktpURL, &selfieURL, &createdAt,
		&contractID, &startDate, &endDate, &rentalDuration, &monthlyRent, &totalPrice, &deposit, &paymentDueDay, &contractStatus, &contractNotes,
		&roomID, &roomNumber, &roomPrice, &roomDescription, &roomStatus,
		&latestPaymentStatus, &latestPaymentAmount,
	)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"id":         uID,
		"name":       name,
		"email":      email,
		"phone":      phone,
		"ktp_url":    ktpURL,
		"selfie_url": selfieURL,
		"created_at": createdAt,
	}

	if contractID != nil {
		result["contract"] = map[string]interface{}{
			"id":                    *contractID,
			"start_date":            *startDate,
			"end_date":              *endDate,
			"rental_duration":       *rentalDuration,
			"monthly_rent":          *monthlyRent,
			"total_price":           *totalPrice,
			"deposit":               *deposit,
			"payment_due_day":       *paymentDueDay,
			"status":                *contractStatus,
			"notes":                 *contractNotes,
			"latest_payment_status": latestPaymentStatus,
			"latest_payment_amount": latestPaymentAmount,
		}
	} else {
		result["contract"] = nil
	}

	if roomID != nil {
		result["room"] = map[string]interface{}{
			"id":              *roomID,
			"room_number":     *roomNumber,
			"price_per_month": *roomPrice,
			"description":     *roomDescription,
			"status":          *roomStatus,
		}
	} else {
		result["room"] = nil
	}

	return result, nil
}

func (r *UserRepository) UpdateTenantProfile(ctx context.Context, id uuid.UUID, name string, phone string, roomIDStr string, entryDateStr string, rentalDuration int, ktpURL *string, selfieURL *string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Update user profile details
	queryUser := `UPDATE users SET name = $1, phone = $2, ktp_url = COALESCE($3, ktp_url), selfie_url = COALESCE($4, selfie_url) WHERE id = $5`
	_, err = tx.Exec(ctx, queryUser, name, phone, ktpURL, selfieURL, id)
	if err != nil {
		return err
	}

	// 2. Fetch the active contract for this user
	var contractID uuid.UUID
	var oldRoomID *uuid.UUID
	err = tx.QueryRow(ctx, "SELECT id, room_id FROM contracts WHERE user_id = $1 AND status = 'active' LIMIT 1", id).Scan(&contractID, &oldRoomID)
	
	var newRoomID *uuid.UUID
	if roomIDStr != "" {
		if parsedRoomID, errParse := uuid.Parse(roomIDStr); errParse == nil {
			newRoomID = &parsedRoomID
		}
	}

	if err == nil {
		// Found active contract, update it
		entryDate, _ := time.Parse("2006-01-02", entryDateStr)
		if entryDate.IsZero() {
			entryDate = time.Now()
		}
		if rentalDuration <= 0 {
			rentalDuration = 1
		}
		endDate := entryDate.AddDate(0, rentalDuration, 0)
		dueDate := entryDate.AddDate(0, 1, -3)
		paymentDueDay := dueDate.Day()
		notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)

		updateContractQ := `UPDATE contracts SET room_id = $1, start_date = $2, end_date = $3, rental_duration = $4, payment_due_day = $5, notes = $6 WHERE id = $7`
		_, err = tx.Exec(ctx, updateContractQ, newRoomID, entryDate, endDate, rentalDuration, paymentDueDay, notes, contractID)
		if err != nil {
			return err
		}

		// Handle room status updates if room_id changed
		if oldRoomID != nil && newRoomID != nil && oldRoomID.String() != newRoomID.String() {
			_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", oldRoomID)
			_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", newRoomID)
		} else if oldRoomID == nil && newRoomID != nil {
			_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", newRoomID)
		}
	} else {
		// If no active contract exists but roomIDStr is provided, let's create a contract!
		if newRoomID != nil {
			var monthlyRent float64
			_ = tx.QueryRow(ctx, "SELECT price_per_month FROM rooms WHERE id = $1", newRoomID).Scan(&monthlyRent)

			entryDate, _ := time.Parse("2006-01-02", entryDateStr)
			if entryDate.IsZero() {
				entryDate = time.Now()
			}
			if rentalDuration <= 0 {
				rentalDuration = 1
			}
			endDate := entryDate.AddDate(0, rentalDuration, 0)
			dueDate := entryDate.AddDate(0, 1, -3)
			paymentDueDay := dueDate.Day()
			notes := fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)

			contractQuery := `INSERT INTO contracts (room_id, user_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes) 
			                  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
			_, err = tx.Exec(ctx, contractQuery, newRoomID, id, entryDate, endDate, rentalDuration, monthlyRent, monthlyRent*float64(rentalDuration), 0, paymentDueDay, "active", notes)
			if err != nil {
				return err
			}
			_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", newRoomID)
		}
	}

	return tx.Commit(ctx)
}

func (r *UserRepository) DeleteTenant(ctx context.Context, id uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Get room_id for active contracts first
	var roomIDs []uuid.UUID
	rows, err := tx.Query(ctx, "SELECT room_id FROM contracts WHERE user_id = $1 AND room_id IS NOT NULL", id)
	if err == nil {
		for rows.Next() {
			var rID uuid.UUID
			if errScan := rows.Scan(&rID); errScan == nil {
				roomIDs = append(roomIDs, rID)
			}
		}
		rows.Close()
	}

	// Delete contracts
	_, err = tx.Exec(ctx, "DELETE FROM contracts WHERE user_id = $1", id)
	if err != nil {
		return err
	}

	// Set rooms status back to available
	for _, rID := range roomIDs {
		_, _ = tx.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", rID)
	}

	// Delete complaints
	_, _ = tx.Exec(ctx, "DELETE FROM complaints WHERE user_id = $1", id)

	// Delete payments
	_, _ = tx.Exec(ctx, "DELETE FROM payments WHERE contract_id IN (SELECT id FROM contracts WHERE user_id = $1)", id)

	// Delete user
	_, err = tx.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

