package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepo keeps identity global while making every staff-managed tenancy
// operation require a property boundary.
type UserRepo interface {
	Create(context.Context, *model.User) error
	FindByEmail(context.Context, string) (*model.User, error)
	FindByID(context.Context, uuid.UUID) (*model.User, error)
	FindByVerificationToken(context.Context, string) (*model.User, error)
	IsUserActive(context.Context, uuid.UUID) (bool, error)
	VerifyUser(context.Context, uuid.UUID) error
	SetOTP(context.Context, string, string, time.Time) error
	ResetPassword(context.Context, string, string) error
	UpdateWhatsAppGroupLink(context.Context, uuid.UUID, string) error
	UpdateProfile(context.Context, uuid.UUID, string, string, string) error
	UpdatePassword(context.Context, uuid.UUID, string) error
	GetMyTenantProfile(context.Context, uuid.UUID) (map[string]any, error)
	GetTenantProfile(context.Context, uuid.UUID, uuid.UUID) (map[string]any, error)
	UpdateTenantProfile(context.Context, uuid.UUID, uuid.UUID, string, string, string, string, int, *string, *string, *time.Time, *string, *string, *string, *string, *string, *string) error
	DeleteTenant(context.Context, uuid.UUID, uuid.UUID) error
	CheckoutTenant(context.Context, uuid.UUID, uuid.UUID) error
	ChangeRoom(context.Context, uuid.UUID, uuid.UUID, string) error
	ExtendContract(context.Context, uuid.UUID, uuid.UUID, uuid.UUID, time.Time, int, float64, float64, float64, float64, float64, string, int, string) error
}

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

// Create atomically provisions the owner's first property. A successful owner
// registration can therefore never exist without an active property boundary.
func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	err = tx.QueryRow(ctx, `
		INSERT INTO users (name,email,password_hash,role,verification_token,phone)
		VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,
		user.Name, strings.ToLower(strings.TrimSpace(user.Email)), user.PasswordHash,
		user.Role, user.VerificationToken, user.Phone,
	).Scan(&user.ID, &user.CreatedAt)
	if err != nil {
		return err
	}

	if user.Role == "owner" {
		propertyName := strings.TrimSpace(user.DefaultPropertyName)
		if propertyName == "" {
			propertyName = "Kos " + strings.TrimSpace(user.Name)
		}
		var propertyID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO properties (name,timezone,currency,status,created_by)
			VALUES ($1,'Asia/Jakarta','IDR','active',$2) RETURNING id`,
			propertyName, user.ID,
		).Scan(&propertyID); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO property_memberships (
				property_id,user_id,role,status,permissions,created_by
			) VALUES ($1,$2,'property_owner','active','[]'::jsonb,$2)`,
			propertyID, user.ID,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, userSelect+` WHERE LOWER(email)=LOWER($1)`, strings.TrimSpace(email)), true)
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, userSelect+` WHERE id=$1`, id), true)
}

func (r *UserRepository) FindByVerificationToken(ctx context.Context, token string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, userSelect+` WHERE verification_token=$1`, token), true)
}

func (r *UserRepository) IsUserActive(ctx context.Context, id uuid.UUID) (bool, error) {
	var active bool
	err := r.db.QueryRow(ctx, `SELECT is_active FROM users WHERE id=$1`, id).Scan(&active)
	return active, err
}

// IsSessionValid makes JWT revocation stateful without storing individual
// tokens. Tokens issued at or before revoked_after are rejected by middleware.
func (r *UserRepository) IsSessionValid(ctx context.Context, id uuid.UUID, issuedAt time.Time) (bool, error) {
	var revokedAfter time.Time
	err := r.db.QueryRow(ctx, `SELECT revoked_after FROM tenant_session_revocations WHERE user_id=$1`, id).Scan(&revokedAfter)
	if err == pgx.ErrNoRows {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return issuedAt.After(revokedAfter), nil
}

func (r *UserRepository) VerifyUser(ctx context.Context, id uuid.UUID) error {
	command, err := r.db.Exec(ctx, `
		UPDATE users SET is_verified=TRUE,verification_token=NULL WHERE id=$1`, id,
	)
	return requireOne(command, err)
}

func (r *UserRepository) SetOTP(ctx context.Context, email, code string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET otp_code=$1,otp_expires_at=$2 WHERE LOWER(email)=LOWER($3)`,
		code, expiresAt, email,
	)
	return err
}

func (r *UserRepository) ResetPassword(ctx context.Context, email, newPasswordHash string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE users SET password_hash=$1,otp_code=NULL,otp_expires_at=NULL
		WHERE LOWER(email)=LOWER($2)`, newPasswordHash, email,
	)
	return err
}

// Deprecated compatibility method. Property settings should be updated on the
// property record; this remains only for tenant-facing legacy behavior.
func (r *UserRepository) UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error {
	command, err := r.db.Exec(ctx, `UPDATE users SET whatsapp_group_link=$1 WHERE id=$2`, link, id)
	return requireOne(command, err)
}

func (r *UserRepository) UpdateProfile(ctx context.Context, id uuid.UUID, name, email, phone string) error {
	command, err := r.db.Exec(ctx, `
		UPDATE users SET name=$1,email=LOWER($2),phone=$3 WHERE id=$4`,
		name, strings.TrimSpace(email), phone, id,
	)
	return requireOne(command, err)
}

func (r *UserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, hash string) error {
	command, err := r.db.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2`, hash, id)
	return requireOne(command, err)
}

func (r *UserRepository) GetMyTenantProfile(ctx context.Context, userID uuid.UUID) (map[string]any, error) {
	var propertyID uuid.UUID
	if err := r.db.QueryRow(ctx, `
		SELECT property_id FROM contracts
		WHERE user_id=$1 AND status='active'
		ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&propertyID); err != nil {
		return nil, err
	}
	return r.GetTenantProfile(ctx, propertyID, userID)
}

func (r *UserRepository) GetTenantProfile(ctx context.Context, propertyID, userID uuid.UUID) (map[string]any, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			u.id,u.name,u.email,COALESCE(u.phone,''),u.ktp_url,u.selfie_url,
			u.is_active,u.date_of_birth,u.gender,u.job,u.emergency_contact_phone,
			u.emergency_contact_relation,u.emergency_contact_name,
			u.additional_doc_url,u.created_at,
			c.id,c.property_id,c.start_date,c.end_date,c.rental_duration,
			c.monthly_rent,c.total_price,COALESCE(c.deposit,0),
			COALESCE(c.payment_interval,'monthly'),COALESCE(c.payment_due_day,1),
			c.status,COALESCE(c.notes,''),
			r.id,r.room_number,r.price_per_month,COALESCE(r.description,''),
			r.status,r.type,r.floor,
			(SELECT p.status FROM payments p
			 WHERE p.property_id=c.property_id AND p.contract_id=c.id
			 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1),
			(SELECT p.amount_rent+p.amount_electricity+p.amount_water+p.amount_other
			 FROM payments p WHERE p.property_id=c.property_id AND p.contract_id=c.id
			 ORDER BY p.period_year DESC,p.period_month DESC,p.due_date DESC LIMIT 1),
			pr.name
		FROM users u
		JOIN LATERAL (
			SELECT * FROM contracts
			WHERE user_id=u.id AND property_id=$1
			ORDER BY (status='active') DESC,created_at DESC LIMIT 1
		) c ON TRUE
		LEFT JOIN rooms r ON r.id=c.room_id AND r.property_id=c.property_id
		JOIN properties pr ON pr.id=c.property_id
		WHERE u.id=$2`, propertyID, userID)

	var id, contractID, contractPropertyID uuid.UUID
	var name, email, phone string
	var ktpURL, selfieURL, gender, job *string
	var emergencyPhone, emergencyRelation, emergencyName, additionalDocURL *string
	var active bool
	var dateOfBirth *time.Time
	var createdAt, startDate, endDate time.Time
	var duration, dueDay int
	var monthlyRent, totalPrice, deposit float64
	var interval, contractStatus, notes string
	var roomID *uuid.UUID
	var roomNumber, roomDescription, roomStatus, roomType, roomFloor *string
	var roomPrice *float64
	var latestPaymentStatus *string
	var latestPaymentAmount *float64
	var propertyName string
	if err := row.Scan(
		&id, &name, &email, &phone, &ktpURL, &selfieURL, &active,
		&dateOfBirth, &gender, &job, &emergencyPhone, &emergencyRelation,
		&emergencyName, &additionalDocURL, &createdAt, &contractID,
		&contractPropertyID, &startDate, &endDate, &duration, &monthlyRent,
		&totalPrice, &deposit, &interval, &dueDay, &contractStatus, &notes,
		&roomID, &roomNumber, &roomPrice, &roomDescription, &roomStatus,
		&roomType, &roomFloor, &latestPaymentStatus, &latestPaymentAmount,
		&propertyName,
	); err != nil {
		return nil, err
	}

	result := map[string]any{
		"id": id, "name": name, "email": email, "phone": phone,
		"ktp_url": ktpURL, "selfie_url": selfieURL, "is_active": active,
		"date_of_birth": dateOfBirth, "gender": gender, "job": job,
		"emergency_contact_phone":    emergencyPhone,
		"emergency_contact_relation": emergencyRelation,
		"emergency_contact_name":     emergencyName,
		"additional_doc_url":         additionalDocURL, "created_at": createdAt,
		"property": map[string]any{"id": contractPropertyID, "name": propertyName},
		"contract": map[string]any{
			"id": contractID, "property_id": contractPropertyID,
			"start_date": startDate, "end_date": endDate,
			"rental_duration": duration, "monthly_rent": monthlyRent,
			"total_price": totalPrice, "deposit": deposit,
			"payment_interval": interval, "payment_due_day": dueDay,
			"status": contractStatus, "notes": notes,
			"latest_payment_status": latestPaymentStatus,
			"latest_payment_amount": latestPaymentAmount,
		},
	}
	if roomID != nil {
		result["room"] = map[string]any{
			"id": *roomID, "property_id": contractPropertyID,
			"room_number": valueOrEmpty(roomNumber), "price_per_month": roomPrice,
			"description": valueOrEmpty(roomDescription),
			"status":      valueOrEmpty(roomStatus), "type": valueOrEmpty(roomType),
			"floor": valueOrEmpty(roomFloor),
		}
	} else {
		result["room"] = nil
	}
	return result, nil
}

func (r *UserRepository) UpdateTenantProfile(
	ctx context.Context,
	propertyID, userID uuid.UUID,
	name, phone, roomIDText, entryDateText string,
	rentalDuration int,
	ktpURL, selfieURL *string,
	dateOfBirth *time.Time,
	gender, job, emergencyPhone, emergencyRelation, emergencyName, additionalDocURL *string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var contractID uuid.UUID
	var oldRoomID *uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id,room_id FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active'
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, propertyID, userID,
	).Scan(&contractID, &oldRoomID); err != nil {
		return err
	}

	var newRoomID *uuid.UUID
	if strings.TrimSpace(roomIDText) != "" {
		parsed, err := uuid.Parse(roomIDText)
		if err != nil {
			return fmt.Errorf("invalid room ID")
		}
		newRoomID = &parsed
		if oldRoomID == nil || *oldRoomID != parsed {
			var status string
			if err := tx.QueryRow(ctx, `
				SELECT status FROM rooms
				WHERE property_id=$1 AND id=$2 FOR UPDATE`, propertyID, parsed,
			).Scan(&status); err != nil {
				return err
			}
			if status != "available" {
				return fmt.Errorf("target room is not available")
			}
		}
	}

	command, err := tx.Exec(ctx, `
		UPDATE users SET name=$1,phone=$2,ktp_url=COALESCE($3,ktp_url),
			selfie_url=COALESCE($4,selfie_url),date_of_birth=$5,gender=$6,job=$7,
			emergency_contact_phone=$8,emergency_contact_relation=$9,
			emergency_contact_name=$10,additional_doc_url=COALESCE($11,additional_doc_url)
		WHERE id=$12`, name, phone, ktpURL, selfieURL, dateOfBirth, gender, job,
		emergencyPhone, emergencyRelation, emergencyName, additionalDocURL, userID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}

	entryDate, _ := time.Parse("2006-01-02", entryDateText)
	if entryDate.IsZero() {
		entryDate = time.Now()
	}
	if rentalDuration <= 0 {
		rentalDuration = 1
	}
	endDate := entryDate.AddDate(0, rentalDuration, 0)
	dueDay := entryDate.AddDate(0, 1, -3).Day()
	_, err = tx.Exec(ctx, `
		UPDATE contracts SET room_id=$1,start_date=$2,end_date=$3,
			rental_duration=$4,payment_due_day=$5
		WHERE id=$6 AND property_id=$7`,
		newRoomID, entryDate, endDate, rentalDuration, dueDay,
		contractID, propertyID,
	)
	if err != nil {
		return err
	}
	if oldRoomID != nil && (newRoomID == nil || *oldRoomID != *newRoomID) {
		if _, err := tx.Exec(ctx, `
			UPDATE rooms SET status='available' WHERE property_id=$1 AND id=$2`,
			propertyID, *oldRoomID,
		); err != nil {
			return err
		}
	}
	if newRoomID != nil && (oldRoomID == nil || *oldRoomID != *newRoomID) {
		if err := updateRoomStatus(ctx, tx, propertyID, *newRoomID, "occupied"); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// DeleteTenant removes the tenancy from one property, never the global user.
func (r *UserRepository) DeleteTenant(ctx context.Context, propertyID, userID uuid.UUID) error {
	return r.endTenantContracts(ctx, propertyID, userID, "cancelled")
}

func (r *UserRepository) CheckoutTenant(ctx context.Context, propertyID, userID uuid.UUID) error {
	return r.endTenantContracts(ctx, propertyID, userID, "inactive")
}

func (r *UserRepository) endTenantContracts(ctx context.Context, propertyID, userID uuid.UUID, status string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	rows, err := tx.Query(ctx, `
		SELECT room_id FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active' FOR UPDATE`,
		propertyID, userID,
	)
	if err != nil {
		return err
	}
	roomIDs := make([]uuid.UUID, 0)
	for rows.Next() {
		var roomID *uuid.UUID
		if err := rows.Scan(&roomID); err != nil {
			rows.Close()
			return err
		}
		if roomID != nil {
			roomIDs = append(roomIDs, *roomID)
		}
	}
	rows.Close()
	if len(roomIDs) == 0 {
		return pgx.ErrNoRows
	}
	if _, err := tx.Exec(ctx, `
		UPDATE contracts SET status=$1,end_date=CURRENT_DATE
		WHERE property_id=$2 AND user_id=$3 AND status='active'`,
		status, propertyID, userID,
	); err != nil {
		return err
	}
	for _, roomID := range roomIDs {
		if err := updateRoomStatus(ctx, tx, propertyID, roomID, "available"); err != nil {
			return err
		}
	}
	// A checkout/deactivation terminates the tenant's active access. This is
	// intentionally global to the identity because JWTs are not property-bound.
	if _, err := tx.Exec(ctx, `UPDATE tenant_profiles SET status='inactive',deactivated_at=NOW(),updated_at=NOW() WHERE property_id=$1 AND user_id=$2 AND status='active'`, propertyID, userID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO tenant_session_revocations (user_id,revoked_after,reason)
		VALUES ($1,NOW(),$2)
		ON CONFLICT (user_id) DO UPDATE SET revoked_after=EXCLUDED.revoked_after,reason=EXCLUDED.reason,updated_at=NOW()`, userID, "checkout"); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *UserRepository) ChangeRoom(ctx context.Context, propertyID, userID uuid.UUID, roomIDText string) error {
	newRoomID, err := uuid.Parse(roomIDText)
	if err != nil {
		return fmt.Errorf("invalid room ID")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var targetStatus string
	if err := tx.QueryRow(ctx, `
		SELECT status FROM rooms WHERE property_id=$1 AND id=$2 FOR UPDATE`,
		propertyID, newRoomID,
	).Scan(&targetStatus); err != nil {
		return err
	}
	if targetStatus != "available" {
		return fmt.Errorf("target room is not available")
	}
	var contractID uuid.UUID
	var oldRoomID *uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id,room_id FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active'
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, propertyID, userID,
	).Scan(&contractID, &oldRoomID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE contracts SET room_id=$1 WHERE property_id=$2 AND id=$3`,
		newRoomID, propertyID, contractID,
	); err != nil {
		return err
	}
	if oldRoomID != nil {
		if err := updateRoomStatus(ctx, tx, propertyID, *oldRoomID, "available"); err != nil {
			return err
		}
	}
	if err := updateRoomStatus(ctx, tx, propertyID, newRoomID, "occupied"); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *UserRepository) ExtendContract(
	ctx context.Context,
	propertyID, actorID, userID uuid.UUID,
	startDate time.Time,
	rentalDuration int,
	monthlyRent, electricity, water, other, deposit float64,
	paymentInterval string,
	paymentDueDay int,
	notes string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var oldContractID, roomID uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id,room_id FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active'
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, propertyID, userID,
	).Scan(&oldContractID, &roomID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE contracts SET status='inactive' WHERE property_id=$1 AND id=$2`,
		propertyID, oldContractID,
	); err != nil {
		return err
	}
	contract := &model.Contract{
		PropertyID: propertyID, RoomID: &roomID, UserID: &userID, OwnerID: actorID,
		StartDate: startDate, RentalDuration: rentalDuration, MonthlyRent: monthlyRent,
		ElectricityBill: electricity, WaterBill: water, OtherBills: other,
		Deposit: deposit, PaymentInterval: paymentInterval,
		PaymentDueDay: paymentDueDay, Notes: notes, Status: "active",
	}
	prepareContract(contract)
	if paymentInterval == "per_contract" {
		contract.TotalPrice = monthlyRent*float64(contract.RentalDuration) +
			electricity*float64(contract.RentalDuration) +
			water*float64(contract.RentalDuration) +
			other*float64(contract.RentalDuration) + deposit
	} else {
		contract.TotalPrice = monthlyRent + electricity + water + other + deposit
	}
	return createExtendedContract(ctx, tx, contract, actorID)
}

func createExtendedContract(ctx context.Context, tx pgx.Tx, contract *model.Contract, actorID uuid.UUID) error {
	err := tx.QueryRow(ctx, `
		INSERT INTO contracts (
			property_id,room_id,user_id,owner_id,start_date,end_date,rental_duration,
			monthly_rent,total_price,deposit,payment_due_day,status,notes,
			electricity_bill,water_bill,other_bills,payment_interval
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id,created_at`,
		contract.PropertyID, contract.RoomID, contract.UserID, actorID,
		contract.StartDate, contract.EndDate, contract.RentalDuration,
		contract.MonthlyRent, contract.TotalPrice, contract.Deposit,
		contract.PaymentDueDay, contract.Status, contract.Notes,
		contract.ElectricityBill, contract.WaterBill, contract.OtherBills,
		contract.PaymentInterval,
	).Scan(&contract.ID, &contract.CreatedAt)
	if err != nil {
		return err
	}
	rent, electricity, water, other := initialBillAmounts(contract)
	_, err = tx.Exec(ctx, `
		INSERT INTO payments (
			id,property_id,contract_id,owner_id,period_month,period_year,
			amount_rent,amount_electricity,amount_water,amount_other,total_paid,
			payment_method,status,due_date,notes
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,'','unpaid',$11,$12)
		ON CONFLICT (contract_id,period_month,period_year) DO NOTHING`,
		uuid.New(), contract.PropertyID, contract.ID, actorID,
		int(contract.StartDate.Month()), contract.StartDate.Year(), rent,
		electricity, water, other, contract.StartDate.AddDate(0, 1, -3),
		contract.Notes,
	)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const userSelect = `
	SELECT id,name,email,password_hash,role,is_verified,verification_token,
		otp_code,otp_expires_at,whatsapp_group_link,COALESCE(phone,''),ktp_url,
		selfie_url,is_active,date_of_birth,gender,job,emergency_contact_phone,
		emergency_contact_relation,emergency_contact_name,additional_doc_url,created_at
	FROM users`

type userRow interface{ Scan(...any) error }

func scanUser(row userRow, includeAuthFields bool) (*model.User, error) {
	_ = includeAuthFields
	user := &model.User{}
	err := row.Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role,
		&user.IsVerified, &user.VerificationToken, &user.OTPCode,
		&user.OTPExpiresAt, &user.WhatsAppGroupLink, &user.Phone, &user.KtpURL,
		&user.SelfieURL, &user.IsActive, &user.DateOfBirth, &user.Gender,
		&user.Job, &user.EmergencyContactPhone, &user.EmergencyContactRelation,
		&user.EmergencyContactName, &user.AdditionalDocURL, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

type rowsAffected interface{ RowsAffected() int64 }

func requireOne(command rowsAffected, err error) error {
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return nil
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
