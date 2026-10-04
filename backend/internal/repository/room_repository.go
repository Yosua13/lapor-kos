package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoomRepository struct {
	db *pgxpool.Pool
}

// ErrTenantInvitationRequired is returned when an owner tries to attach a
// contact that has not activated a verified tenant account yet.
var ErrTenantInvitationRequired = errors.New("tenant account must be activated through an invitation first")

func NewRoomRepository(db *pgxpool.Pool) *RoomRepository {
	return &RoomRepository{db: db}
}

func (r *RoomRepository) Create(ctx context.Context, propertyID uuid.UUID, room *model.Room) error {
	room.PropertyID = propertyID
	return r.db.QueryRow(ctx, `
		INSERT INTO rooms (
			property_id, room_number, price_per_month, description, status,
			type, floor, is_draft
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, created_at`,
		propertyID, strings.TrimSpace(room.RoomNumber), room.PricePerMonth,
		room.Description, room.Status, room.Type, room.Floor, room.IsDraft,
	).Scan(&room.ID, &room.CreatedAt)
}

func (r *RoomRepository) CreateWithTenant(
	ctx context.Context,
	propertyID, actorID uuid.UUID,
	room *model.Room,
	user *model.User,
	contract *model.Contract,
	payment *model.Payment,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	room.PropertyID = propertyID
	err = tx.QueryRow(ctx, `
		INSERT INTO rooms (
			property_id, room_number, price_per_month, description, status,
			type, floor, is_draft
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING id, created_at`,
		propertyID, strings.TrimSpace(room.RoomNumber), room.PricePerMonth,
		room.Description, room.Status, room.Type, room.Floor, room.IsDraft,
	).Scan(&room.ID, &room.CreatedAt)
	if err != nil {
		return err
	}

	if room.Status == "occupied" && hasTenantData(user) {
		userID, err := findOrCreateTenant(ctx, tx, propertyID, user)
		if err != nil {
			return err
		}
		if err := createRoomContractAndBill(
			ctx, tx, propertyID, actorID, room.ID, userID, contract, payment,
		); err != nil {
			return err
		}
		// A room is only occupied when the lifecycle service activates the
		// accepted contract and creates its occupancy period.
		room.Status = "available"
		if err := updateRoomStatus(ctx, tx, propertyID, room.ID, room.Status); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *RoomRepository) UpdateWithTenant(
	ctx context.Context,
	propertyID, actorID uuid.UUID,
	room *model.Room,
	user *model.User,
	contract *model.Contract,
	payment *model.Payment,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	command, err := tx.Exec(ctx, `
		UPDATE rooms SET room_number=$1, price_per_month=$2, description=$3,
			status=$4, type=$5, floor=$6, is_draft=$7
		WHERE id=$8 AND property_id=$9`,
		strings.TrimSpace(room.RoomNumber), room.PricePerMonth, room.Description,
		room.Status, room.Type, room.Floor, room.IsDraft, room.ID, propertyID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	room.PropertyID = propertyID

	if room.Status == "occupied" && hasTenantData(user) {
		userID, err := findOrCreateTenant(ctx, tx, propertyID, user)
		if err != nil {
			return err
		}

		var existingID uuid.UUID
		err = tx.QueryRow(ctx, `
			SELECT id FROM contracts
			WHERE property_id=$1 AND room_id=$2 AND status IN ('draft','pending_tenant','scheduled','active')
			ORDER BY created_at DESC LIMIT 1
			FOR UPDATE`, propertyID, room.ID,
		).Scan(&existingID)
		if err != nil && err != pgx.ErrNoRows {
			return err
		}
		if err == pgx.ErrNoRows {
			if err := createRoomContractAndBill(
				ctx, tx, propertyID, actorID, room.ID, userID, contract, payment,
			); err != nil {
				return err
			}
		} else {
			_ = existingID
			return ErrContractHistoryImmutable
		}
		room.Status = "available"
		if err := updateRoomStatus(ctx, tx, propertyID, room.ID, room.Status); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *RoomRepository) AssignTenant(
	ctx context.Context,
	propertyID, actorID, roomID uuid.UUID,
	user *model.User,
	contract *model.Contract,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var status string
	if err := tx.QueryRow(ctx, `
		SELECT status FROM rooms
		WHERE id=$1 AND property_id=$2 FOR UPDATE`, roomID, propertyID,
	).Scan(&status); err != nil {
		return err
	}
	if status == "occupied" {
		return fmt.Errorf("kamar tidak tersedia")
	}
	userID, err := findOrCreateTenant(ctx, tx, propertyID, user)
	if err != nil {
		return err
	}
	if err := createRoomContractAndBill(
		ctx, tx, propertyID, actorID, roomID, userID, contract, &model.Payment{},
	); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *RoomRepository) FindAll(ctx context.Context, propertyID uuid.UUID) ([]model.Room, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, property_id, room_number, price_per_month,
			COALESCE(description,''), status, floor, is_draft, type, created_at
		FROM rooms WHERE property_id=$1 ORDER BY room_number`, propertyID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rooms := make([]model.Room, 0)
	for rows.Next() {
		var room model.Room
		if err := rows.Scan(
			&room.ID, &room.PropertyID, &room.RoomNumber, &room.PricePerMonth,
			&room.Description, &room.Status, &room.Floor, &room.IsDraft,
			&room.Type, &room.CreatedAt,
		); err != nil {
			return nil, err
		}
		rooms = append(rooms, room)
	}
	return rooms, rows.Err()
}

func (r *RoomRepository) FindByID(ctx context.Context, propertyID, id uuid.UUID) (*model.Room, error) {
	room := &model.Room{}
	err := r.db.QueryRow(ctx, `
		SELECT id, property_id, room_number, price_per_month,
			COALESCE(description,''), status, floor, is_draft, type, created_at
		FROM rooms WHERE property_id=$1 AND id=$2`, propertyID, id,
	).Scan(
		&room.ID, &room.PropertyID, &room.RoomNumber, &room.PricePerMonth,
		&room.Description, &room.Status, &room.Floor, &room.IsDraft,
		&room.Type, &room.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return room, nil
}

func (r *RoomRepository) Update(ctx context.Context, propertyID uuid.UUID, room *model.Room) error {
	command, err := r.db.Exec(ctx, `
		UPDATE rooms SET room_number=$1, price_per_month=$2, description=$3,
			status=$4, floor=$5, type=$6, is_draft=$7
		WHERE id=$8 AND property_id=$9`,
		strings.TrimSpace(room.RoomNumber), room.PricePerMonth, room.Description,
		room.Status, room.Floor, room.Type, room.IsDraft, room.ID, propertyID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	room.PropertyID = propertyID
	return nil
}

func (r *RoomRepository) Delete(ctx context.Context, propertyID, id uuid.UUID) error {
	return r.DeleteWithTenant(ctx, propertyID, id, false)
}

// DeleteWithTenant removes only relations in the selected property. Global
// user identities and history in other properties are deliberately retained.
func (r *RoomRepository) DeleteWithTenant(
	ctx context.Context, propertyID, id uuid.UUID, endActiveTenancy bool,
) error {
	_ = endActiveTenancy // Contract history must be ended through the lifecycle API.
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var lockedID uuid.UUID
	if err := tx.QueryRow(ctx, `
		SELECT id FROM rooms WHERE property_id=$1 AND id=$2 FOR UPDATE`,
		propertyID, id,
	).Scan(&lockedID); err != nil {
		return err
	}
	rows, err := tx.Query(ctx, `
		SELECT user_id FROM contracts
		WHERE property_id=$1 AND room_id=$2 AND status='active' FOR UPDATE`, propertyID, id)
	if err != nil {
		return err
	}
	activeUserIDs := make([]uuid.UUID, 0)
	for rows.Next() {
		var userID *uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			rows.Close()
			return err
		}
		if userID != nil {
			activeUserIDs = append(activeUserIDs, *userID)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	activeContracts := len(activeUserIDs)
	// A legacy/incomplete contract may not yet have an identity, but it still
	// blocks destructive room deletion until the caller explicitly ends it.
	if activeContracts == 0 {
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM contracts WHERE property_id=$1 AND room_id=$2 AND status='active'`, propertyID, id).Scan(&activeContracts); err != nil {
			return err
		}
	}
	if activeContracts > 0 {
		return fmt.Errorf("room has an active tenancy")
	}
	var contractHistory int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM contracts WHERE property_id=$1 AND room_id=$2`, propertyID, id).Scan(&contractHistory); err != nil {
		return err
	}
	if contractHistory > 0 {
		return fmt.Errorf("room has contract history and cannot be deleted")
	}
	command, err := tx.Exec(ctx,
		`DELETE FROM rooms WHERE property_id=$1 AND id=$2`, propertyID, id,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return tx.Commit(ctx)
}

func hasTenantData(user *model.User) bool {
	return user != nil && (strings.TrimSpace(user.Name) != "" || strings.TrimSpace(user.Email) != "")
}

func findOrCreateTenant(ctx context.Context, tx pgx.Tx, propertyID uuid.UUID, user *model.User) (uuid.UUID, error) {
	if user == nil || strings.TrimSpace(user.Email) == "" {
		return uuid.Nil, fmt.Errorf("tenant email is required")
	}
	email := strings.ToLower(strings.TrimSpace(user.Email))
	var userID uuid.UUID
	var isActive, isVerified bool
	var role string
	err := tx.QueryRow(ctx, `SELECT id,is_active,is_verified,role FROM users WHERE LOWER(email)=$1`, email).Scan(&userID, &isActive, &isVerified, &role)
	if err == nil {
		// Existing identities may belong to other properties. Do not mutate their
		// global PII here; only attach a scoped contract after they have verified
		// an actual tenant account.
		if !isActive || !isVerified || role != "tenant" {
			return uuid.Nil, ErrTenantInvitationRequired
		}
		var profileActive bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM tenant_profiles
				WHERE property_id=$1 AND user_id=$2 AND status='active'
			)`, propertyID, userID,
		).Scan(&profileActive); err != nil {
			return uuid.Nil, err
		}
		if !profileActive {
			return uuid.Nil, ErrTenantInvitationRequired
		}
		return userID, nil
	}
	if err != pgx.ErrNoRows {
		return uuid.Nil, err
	}
	// New tenant identities must be created through the invitation activation
	// flow. It lets the tenant choose their password and verify contact details;
	// this legacy room flow may only attach an already activated account.
	return uuid.Nil, ErrTenantInvitationRequired
}

func prepareContract(contract *model.Contract) {
	if contract.RentalDuration <= 0 {
		contract.RentalDuration = 1
	}
	if contract.StartDate.IsZero() {
		contract.StartDate = time.Now()
	}
	contract.EndDate = contract.StartDate.AddDate(0, contract.RentalDuration, 0)
	if contract.PaymentInterval == "" {
		contract.PaymentInterval = "monthly"
	}
	if contract.PaymentDueDay <= 0 {
		contract.PaymentDueDay = contract.StartDate.AddDate(0, 1, -3).Day()
	}
	contract.Status = model.ContractDraft
	contract.TotalPrice = (contract.MonthlyRent+contract.ElectricityBill+contract.WaterBill+contract.OtherBills)*float64(contract.RentalDuration) + contract.Deposit
	if contract.Notes == "" {
		contract.Notes = fmt.Sprintf(
			"Perpanjangan kontrak dilakukan paling lambat pada tanggal %d",
			contract.PaymentDueDay,
		)
	}
}

func createRoomContractAndBill(
	ctx context.Context,
	tx pgx.Tx,
	propertyID, actorID, roomID, userID uuid.UUID,
	contract *model.Contract,
	payment *model.Payment,
) error {
	_ = payment // Billing is created atomically by lifecycle activation.
	prepareContract(contract)
	contract.PropertyID = propertyID
	contract.OwnerID = actorID
	contract.RoomID = &roomID
	contract.UserID = &userID
	err := tx.QueryRow(ctx, `
		INSERT INTO contracts (
			property_id,room_id,user_id,owner_id,start_date,end_date,
			rental_duration,monthly_rent,total_price,deposit,payment_due_day,
			status,notes,electricity_bill,water_bill,other_bills,payment_interval
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id,created_at`,
		propertyID, roomID, userID, actorID, contract.StartDate, contract.EndDate,
		contract.RentalDuration, contract.MonthlyRent, contract.TotalPrice,
		contract.Deposit, contract.PaymentDueDay, contract.Status, contract.Notes,
		contract.ElectricityBill, contract.WaterBill, contract.OtherBills,
		contract.PaymentInterval,
	).Scan(&contract.ID, &contract.CreatedAt)
	if err != nil {
		return err
	}
	var versionID uuid.UUID
	err = tx.QueryRow(ctx, `INSERT INTO contract_versions(property_id,contract_id,version_number,snapshot,reason,created_by)
		SELECT property_id,id,1,jsonb_build_object('contract_id',id,'property_id',property_id,'room_id',room_id,'user_id',user_id,'start_date',start_date,'end_date',end_date,'rental_duration',rental_duration,'monthly_rent',monthly_rent,'total_price',total_price,'deposit',deposit,'electricity_bill',electricity_bill,'water_bill',water_bill,'other_bills',other_bills,'payment_interval',payment_interval,'payment_due_day',payment_due_day,'notes',notes),'Draft dibuat dari alur kamar',$1 FROM contracts WHERE property_id=$2 AND id=$3 RETURNING id`, actorID, propertyID, contract.ID).Scan(&versionID)
	if err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `UPDATE contracts SET current_version_id=$1 WHERE property_id=$2 AND id=$3`, versionID, propertyID, contract.ID); err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO contract_events(property_id,contract_id,version_id,event_type,to_status,reason,actor_id) VALUES($1,$2,$3,'created','draft','Draft dibuat dari alur kamar',$4)`, propertyID, contract.ID, versionID, actorID)
	return err
}

func updateRoomStatus(
	ctx context.Context, tx pgx.Tx, propertyID, roomID uuid.UUID, status string,
) error {
	command, err := tx.Exec(ctx, `
		UPDATE rooms SET status=$1 WHERE property_id=$2 AND id=$3`,
		status, propertyID, roomID,
	)
	if err != nil {
		return err
	}
	if command.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return nil
}
