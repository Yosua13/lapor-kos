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
	UpdateTenantProfile(context.Context, uuid.UUID, uuid.UUID, string, string, string, string, int, *time.Time, *string, *string, *string, *string, *string) error
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
		WHERE user_id=$1 AND status IN ('active','scheduled','pending_tenant','draft')
		ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'pending_tenant' THEN 2 WHEN 'scheduled' THEN 3 ELSE 4 END,created_at DESC LIMIT 1`, userID,
	).Scan(&propertyID); err != nil {
		return nil, err
	}
	return r.GetTenantProfile(ctx, propertyID, userID)
}

func (r *UserRepository) GetTenantProfile(ctx context.Context, propertyID, userID uuid.UUID) (map[string]any, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			u.id,COALESCE(NULLIF(tp.full_name,''),u.name),
			COALESCE(NULLIF(tp.email,''),u.email),COALESCE(NULLIF(tp.phone,''),u.phone),
			NULL::text,NULL::text,
			u.is_active,tp.date_of_birth,tp.gender,tp.job,tp.emergency_contact_phone,
			tp.emergency_contact_relation,tp.emergency_contact_name,
			NULL::text,u.created_at,
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
		LEFT JOIN tenant_profiles tp ON tp.property_id=c.property_id AND tp.user_id=u.id
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
	dateOfBirth *time.Time,
	gender, job, emergencyPhone, emergencyRelation, emergencyName *string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var oldRoomID *uuid.UUID
	var currentStartDate time.Time
	var currentRentalDuration int
	if err := tx.QueryRow(ctx, `
		SELECT room_id,start_date,rental_duration FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active'
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, propertyID, userID,
	).Scan(&oldRoomID, &currentStartDate, &currentRentalDuration); err != nil {
		return err
	}

	newRoomID := oldRoomID
	if strings.TrimSpace(roomIDText) != "" {
		parsed, err := uuid.Parse(roomIDText)
		if err != nil {
			return fmt.Errorf("invalid room ID")
		}
		newRoomID = &parsed
	}
	entryDate := currentStartDate
	if strings.TrimSpace(entryDateText) != "" {
		entryDate, err = time.Parse("2006-01-02", entryDateText)
		if err != nil {
			return fmt.Errorf("invalid entry date")
		}
	}
	if rentalDuration <= 0 {
		rentalDuration = currentRentalDuration
	}
	roomChanged := (oldRoomID == nil) != (newRoomID == nil)
	if oldRoomID != nil && newRoomID != nil && *oldRoomID != *newRoomID {
		roomChanged = true
	}
	if roomChanged || entryDate.Format("2006-01-02") != currentStartDate.Format("2006-01-02") || rentalDuration != currentRentalDuration {
		return fmt.Errorf("%w: ubah kamar atau periode melalui alur lifecycle kontrak", ErrContractHistoryImmutable)
	}

	// A property owner may update property-scoped tenant details, but must never
	// overwrite the global login identity (users.name, users.phone, email, or
	// identity-document pointers). The tenant profile is the scoped projection.
	command, err := tx.Exec(ctx, `
		INSERT INTO tenant_profiles (
			property_id,user_id,full_name,email,phone,status,activated_at,
			date_of_birth,gender,job,emergency_contact_phone,
			emergency_contact_relation,emergency_contact_name
		)
		SELECT $1,u.id,$2,u.email,$3,'active',NOW(),$4,$5,$6,$7,$8,$9
		FROM users u WHERE u.id=$10
		ON CONFLICT (property_id,user_id) WHERE user_id IS NOT NULL
		DO UPDATE SET
			full_name=EXCLUDED.full_name,
			phone=EXCLUDED.phone,
			date_of_birth=EXCLUDED.date_of_birth,
			gender=EXCLUDED.gender,
			job=EXCLUDED.job,
			emergency_contact_phone=EXCLUDED.emergency_contact_phone,
			emergency_contact_relation=EXCLUDED.emergency_contact_relation,
			emergency_contact_name=EXCLUDED.emergency_contact_name,
			updated_at=NOW()`,
		propertyID, name, phone, dateOfBirth, gender, job, emergencyPhone,
		emergencyRelation, emergencyName, userID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}

	return tx.Commit(ctx)
}

// DeleteTenant removes the tenancy from one property, never the global user.
func (r *UserRepository) DeleteTenant(ctx context.Context, propertyID, userID uuid.UUID) error {
	return r.endTenantContracts(ctx, propertyID, userID, model.ContractTerminated)
}

func (r *UserRepository) CheckoutTenant(ctx context.Context, propertyID, userID uuid.UUID) error {
	return r.endTenantContracts(ctx, propertyID, userID, model.ContractEnded)
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
	if _, err := tx.Exec(ctx, `
		UPDATE occupancy_periods SET end_date=LEAST(end_date,CURRENT_DATE),closed_at=NOW()
		WHERE property_id=$1 AND contract_id IN (
			SELECT id FROM contracts WHERE property_id=$1 AND user_id=$2 AND status=$3
		) AND closed_at IS NULL`, propertyID, userID, status); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO contract_events(property_id,contract_id,version_id,event_type,from_status,to_status,reason,actor_id)
		SELECT property_id,id,current_version_id,'status_changed','active',$3,'Tenant lifecycle action',NULL
		FROM contracts WHERE property_id=$1 AND user_id=$2 AND status=$3`, propertyID, userID, status); err != nil {
		return err
	}
	for _, roomID := range roomIDs {
		if err := updateRoomStatus(ctx, tx, propertyID, roomID, "available"); err != nil {
			return err
		}
	}
	// A checkout/deactivation terminates the tenant's active access. This is
	// intentionally global to the identity because JWTs are not property-bound.
	reason := "checkout"
	if status != model.ContractEnded {
		reason = "tenant_deleted"
	}
	if err := revokeTenantSessionForProperty(ctx, tx, propertyID, userID, reason); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *UserRepository) ChangeRoom(ctx context.Context, propertyID, userID uuid.UUID, roomIDText string) error {
	if _, err := uuid.Parse(roomIDText); err != nil {
		return fmt.Errorf("invalid room ID")
	}
	return fmt.Errorf("%w: perpindahan kamar wajib dibuat sebagai event lifecycle kontrak", ErrContractHistoryImmutable)
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
	var oldEndDate time.Time
	if err := tx.QueryRow(ctx, `
		SELECT id,room_id,end_date FROM contracts
		WHERE property_id=$1 AND user_id=$2 AND status='active'
		ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, propertyID, userID,
	).Scan(&oldContractID, &roomID, &oldEndDate); err != nil {
		return err
	}
	if !startDate.Equal(oldEndDate.AddDate(0, 0, 1)) {
		return fmt.Errorf("renewal must start one day after active contract ends")
	}
	contract := &model.Contract{
		PropertyID: propertyID, RoomID: &roomID, UserID: &userID, OwnerID: actorID,
		StartDate: startDate, RentalDuration: rentalDuration, MonthlyRent: monthlyRent,
		ElectricityBill: electricity, WaterBill: water, OtherBills: other,
		Deposit: deposit, PaymentInterval: paymentInterval,
		PaymentDueDay: paymentDueDay, Notes: notes, Status: model.ContractDraft,
		RenewedFromContractID: &oldContractID,
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
			electricity_bill,water_bill,other_bills,payment_interval,renewed_from_contract_id
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
		RETURNING id,created_at`,
		contract.PropertyID, contract.RoomID, contract.UserID, actorID,
		contract.StartDate, contract.EndDate, contract.RentalDuration,
		contract.MonthlyRent, contract.TotalPrice, contract.Deposit,
		contract.PaymentDueDay, contract.Status, contract.Notes,
		contract.ElectricityBill, contract.WaterBill, contract.OtherBills,
		contract.PaymentInterval, contract.RenewedFromContractID,
	).Scan(&contract.ID, &contract.CreatedAt)
	if err != nil {
		return err
	}
	var versionID uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO contract_versions(property_id,contract_id,version_number,snapshot,reason,created_by)
		SELECT property_id,id,1,jsonb_build_object('contract_id',id,'property_id',property_id,'room_id',room_id,'user_id',user_id,'start_date',start_date,'end_date',end_date,'rental_duration',rental_duration,'monthly_rent',monthly_rent,'total_price',total_price,'deposit',deposit,'electricity_bill',electricity_bill,'water_bill',water_bill,'other_bills',other_bills,'payment_interval',payment_interval,'payment_due_day',payment_due_day,'notes',notes),'Draft renewal dibuat', $1 FROM contracts WHERE property_id=$2 AND id=$3 RETURNING id`, actorID, contract.PropertyID, contract.ID).Scan(&versionID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET current_version_id=$1 WHERE property_id=$2 AND id=$3`, versionID, contract.PropertyID, contract.ID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,to_status,reason,actor_id,metadata) VALUES($1,$2,$3,'renewal_draft_created','draft','Draft renewal dibuat',$4,jsonb_build_object('renewed_from_contract_id',$5))`, contract.PropertyID, contract.ID, versionID, actorID, contract.RenewedFromContractID); err != nil {
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
