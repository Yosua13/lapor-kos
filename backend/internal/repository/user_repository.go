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
	UpdateTenantProfile(ctx context.Context, id uuid.UUID, name string, phone string, roomIDStr string, entryDateStr string, rentalDuration int, ktpURL *string, selfieURL *string, dateOfBirth *time.Time, gender *string, job *string, emergencyContactPhone *string, emergencyContactRelation *string, emergencyContactName *string, additionalDocURL *string) error
	DeleteTenant(ctx context.Context, id uuid.UUID) error
	CheckoutTenant(ctx context.Context, id uuid.UUID) error
	ChangeRoom(ctx context.Context, userID uuid.UUID, roomIDStr string) error
	ExtendContract(ctx context.Context, userID uuid.UUID, ownerID uuid.UUID, startDate time.Time, rentalDuration int, monthlyRent float64, electricityBill float64, waterBill float64, otherBills float64, deposit float64, paymentInterval string, paymentDueDay int, notes string) error
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
	query := `SELECT id, name, email, password_hash, role, is_verified, verification_token, otp_code, otp_expires_at, whatsapp_group_link, phone, ktp_url, selfie_url, is_active, date_of_birth, gender, job, emergency_contact_phone, emergency_contact_relation, emergency_contact_name, additional_doc_url, created_at FROM users WHERE email = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role,
		&user.IsVerified, &user.VerificationToken, &user.OTPCode, &user.OTPExpiresAt, &user.WhatsAppGroupLink, &user.Phone, &user.KtpURL, &user.SelfieURL,
		&user.IsActive, &user.DateOfBirth, &user.Gender, &user.Job, &user.EmergencyContactPhone, &user.EmergencyContactRelation, &user.EmergencyContactName, &user.AdditionalDocURL,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, whatsapp_group_link, phone, ktp_url, selfie_url, is_active, date_of_birth, gender, job, emergency_contact_phone, emergency_contact_relation, emergency_contact_name, additional_doc_url, created_at FROM users WHERE id = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.WhatsAppGroupLink, &user.Phone, &user.KtpURL, &user.SelfieURL,
		&user.IsActive, &user.DateOfBirth, &user.Gender, &user.Job, &user.EmergencyContactPhone, &user.EmergencyContactRelation, &user.EmergencyContactName, &user.AdditionalDocURL,
		&user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByVerificationToken(ctx context.Context, token string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, phone, ktp_url, selfie_url, is_active, date_of_birth, gender, job, emergency_contact_phone, emergency_contact_relation, emergency_contact_name, additional_doc_url, created_at FROM users WHERE verification_token = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, token).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.Phone, &user.KtpURL, &user.SelfieURL,
		&user.IsActive, &user.DateOfBirth, &user.Gender, &user.Job, &user.EmergencyContactPhone, &user.EmergencyContactRelation, &user.EmergencyContactName, &user.AdditionalDocURL,
		&user.CreatedAt,
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
			u.id, u.name, u.email, u.phone, u.ktp_url, u.selfie_url, 
			u.is_active, u.date_of_birth, u.gender, u.job, 
			u.emergency_contact_phone, u.emergency_contact_relation, u.emergency_contact_name, 
			u.additional_doc_url, u.created_at,
			c.id as contract_id, c.start_date, c.end_date, c.rental_duration, c.monthly_rent, c.total_price, c.deposit, c.payment_interval, c.payment_due_day, c.status as contract_status, c.notes as contract_notes,
			r.id as room_id, r.room_number, r.price_per_month, r.description, r.status as room_status, r.type as room_type, r.floor as room_floor,
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
	var isActive bool
	var dateOfBirth *time.Time
	var gender, job, emergencyContactPhone, emergencyContactRelation, emergencyContactName, additionalDocURL *string
	var createdAt time.Time
	
	var contractID, roomID *uuid.UUID
	var startDate, endDate *time.Time
	var rentalDuration, paymentDueDay *int
	var monthlyRent, totalPrice, deposit *float64
	var contractStatus, contractNotes, paymentInterval *string
	var roomNumber, roomDescription, roomStatus, roomType, roomFloor *string
	var roomPrice *float64
	var latestPaymentStatus *string
	var latestPaymentAmount *float64

	err := r.db.QueryRow(ctx, query, userID).Scan(
		&uID, &name, &email, &phone, &ktpURL, &selfieURL, 
		&isActive, &dateOfBirth, &gender, &job, 
		&emergencyContactPhone, &emergencyContactRelation, &emergencyContactName, 
		&additionalDocURL, &createdAt,
		&contractID, &startDate, &endDate, &rentalDuration, &monthlyRent, &totalPrice, &deposit, &paymentInterval, &paymentDueDay, &contractStatus, &contractNotes,
		&roomID, &roomNumber, &roomPrice, &roomDescription, &roomStatus, &roomType, &roomFloor,
		&latestPaymentStatus, &latestPaymentAmount,
	)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"id":                         uID,
		"name":                       name,
		"email":                      email,
		"phone":                      phone,
		"ktp_url":                    ktpURL,
		"selfie_url":                 selfieURL,
		"is_active":                  isActive,
		"date_of_birth":              dateOfBirth,
		"gender":                     gender,
		"job":                        job,
		"emergency_contact_phone":    emergencyContactPhone,
		"emergency_contact_relation": emergencyContactRelation,
		"emergency_contact_name":     emergencyContactName,
		"additional_doc_url":         additionalDocURL,
		"created_at":                 createdAt,
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
			"payment_interval":      *paymentInterval,
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
			"type":            roomType,
			"floor":           roomFloor,
		}
	} else {
		result["room"] = nil
	}

	return result, nil
}

func (r *UserRepository) UpdateTenantProfile(ctx context.Context, id uuid.UUID, name string, phone string, roomIDStr string, entryDateStr string, rentalDuration int, ktpURL *string, selfieURL *string, dateOfBirth *time.Time, gender *string, job *string, emergencyContactPhone *string, emergencyContactRelation *string, emergencyContactName *string, additionalDocURL *string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Update user profile details
	queryUser := `UPDATE users SET 
		name = $1, 
		phone = $2, 
		ktp_url = COALESCE($3, ktp_url), 
		selfie_url = COALESCE($4, selfie_url),
		date_of_birth = $5,
		gender = $6,
		job = $7,
		emergency_contact_phone = $8,
		emergency_contact_relation = $9,
		emergency_contact_name = $10,
		additional_doc_url = COALESCE($11, additional_doc_url)
		WHERE id = $12`
	_, err = tx.Exec(ctx, queryUser, name, phone, ktpURL, selfieURL, dateOfBirth, gender, job, emergencyContactPhone, emergencyContactRelation, emergencyContactName, additionalDocURL, id)
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

func (r *UserRepository) CheckoutTenant(ctx context.Context, id uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Update user to inactive
	_, err = tx.Exec(ctx, "UPDATE users SET is_active = FALSE WHERE id = $1", id)
	if err != nil {
		return err
	}

	// 2. Find active contract
	var contractID uuid.UUID
	var roomID uuid.UUID
	err = tx.QueryRow(ctx, "SELECT id, room_id FROM contracts WHERE user_id = $1 AND status = 'active' LIMIT 1", id).Scan(&contractID, &roomID)
	if err == nil {
		// Update contract status to 'inactive' and set end_date to today
		_, err = tx.Exec(ctx, "UPDATE contracts SET status = 'inactive', end_date = $1 WHERE id = $2", time.Now(), contractID)
		if err != nil {
			return err
		}

		// Update room status to 'available'
		_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", roomID)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *UserRepository) ChangeRoom(ctx context.Context, userID uuid.UUID, roomIDStr string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	newRoomID, err := uuid.Parse(roomIDStr)
	if err != nil {
		return fmt.Errorf("invalid room ID")
	}

	// 1. Get active contract
	var contractID uuid.UUID
	var oldRoomID *uuid.UUID
	err = tx.QueryRow(ctx, "SELECT id, room_id FROM contracts WHERE user_id = $1 AND status = 'active' LIMIT 1", userID).Scan(&contractID, &oldRoomID)
	if err != nil {
		return fmt.Errorf("no active contract found for tenant: %w", err)
	}

	// 2. Update contract room_id
	_, err = tx.Exec(ctx, "UPDATE contracts SET room_id = $1 WHERE id = $2", newRoomID, contractID)
	if err != nil {
		return err
	}

	// 3. Update old room status to available
	if oldRoomID != nil {
		_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'available' WHERE id = $1", *oldRoomID)
		if err != nil {
			return err
		}
	}

	// 4. Update new room status to occupied
	_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", newRoomID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *UserRepository) ExtendContract(ctx context.Context, userID uuid.UUID, ownerID uuid.UUID, startDate time.Time, rentalDuration int, monthlyRent float64, electricityBill float64, waterBill float64, otherBills float64, deposit float64, paymentInterval string, paymentDueDay int, notes string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// 1. Get current active contract to retrieve the room_id (and deactivate it)
	var roomID uuid.UUID
	var oldContractID uuid.UUID
	err = tx.QueryRow(ctx, "SELECT id, room_id FROM contracts WHERE user_id = $1 AND status = 'active' LIMIT 1", userID).Scan(&oldContractID, &roomID)
	if err != nil {
		return fmt.Errorf("no active contract found to extend: %w", err)
	}

	// Deactivate the old contract
	_, err = tx.Exec(ctx, "UPDATE contracts SET status = 'inactive' WHERE id = $1", oldContractID)
	if err != nil {
		return err
	}

	// 2. Calculate dates
	endDate := startDate.AddDate(0, rentalDuration, 0)
	dueDate := startDate.AddDate(0, 1, -3)
	if paymentDueDay == 0 {
		paymentDueDay = dueDate.Day()
	}

	if notes == "" {
		notes = fmt.Sprintf("Perpanjangan kontrak dilakukan paling lambat pada tanggal %d", paymentDueDay)
	}

	var totalPrice float64
	if paymentInterval == "per_contract" {
		totalPrice = (monthlyRent * float64(rentalDuration)) + (electricityBill * float64(rentalDuration)) + (waterBill * float64(rentalDuration)) + (otherBills * float64(rentalDuration)) + deposit
	} else {
		totalPrice = monthlyRent + electricityBill + waterBill + otherBills + deposit
	}

	// 3. Insert new contract
	newContractID := uuid.New()
	contractQuery := `INSERT INTO contracts (id, room_id, user_id, owner_id, start_date, end_date, rental_duration, monthly_rent, total_price, deposit, payment_due_day, status, notes, electricity_bill, water_bill, other_bills, payment_interval) 
					  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`
	_, err = tx.Exec(ctx, contractQuery, newContractID, roomID, userID, ownerID, startDate, endDate, rentalDuration, monthlyRent, totalPrice, deposit, paymentDueDay, "active", notes, electricityBill, waterBill, otherBills, paymentInterval)
	if err != nil {
		return err
	}

	// 4. Insert initial payment for the new contract
	paymentID := uuid.New()
	periodMonth := int(startDate.Month())
	periodYear := startDate.Year()

	var pRent, pElec, pWater, pOther float64
	if paymentInterval == "per_contract" {
		pRent = monthlyRent * float64(rentalDuration)
		pElec = electricityBill * float64(rentalDuration)
		pWater = waterBill * float64(rentalDuration)
		pOther = (otherBills * float64(rentalDuration)) + deposit
	} else {
		pRent = monthlyRent
		pElec = electricityBill
		pWater = waterBill
		pOther = otherBills + deposit
	}

	paymentQuery := `INSERT INTO payments (id, contract_id, owner_id, period_month, period_year, amount_rent, amount_electricity, amount_water, amount_other, total_paid, payment_method, status, due_date, notes)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`
	_, err = tx.Exec(ctx, paymentQuery, paymentID, newContractID, ownerID, periodMonth, periodYear, pRent, pElec, pWater, pOther, 0, "", "unpaid", dueDate, notes)
	if err != nil {
		return err
	}

	// 5. Ensure the room status is occupied
	_, err = tx.Exec(ctx, "UPDATE rooms SET status = 'occupied' WHERE id = $1", roomID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}


