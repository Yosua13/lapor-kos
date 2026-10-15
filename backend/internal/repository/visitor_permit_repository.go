package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrVisitorPermitNotFound    = errors.New("visitor permit not found")
	ErrActiveContractNotFound   = errors.New("no active contract found for tenant")
	ErrInvalidStatusTransition  = errors.New("invalid visitor permit status transition")
	ErrPermitCancelledOrExpired = errors.New("visitor permit is already cancelled or completed")
)

type VisitorPermitRepository struct {
	db *pgxpool.Pool
}

func NewVisitorPermitRepository(db *pgxpool.Pool) *VisitorPermitRepository {
	return &VisitorPermitRepository{db: db}
}

func generatePassToken() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return "VP-" + strings.ToUpper(hex.EncodeToString(b))
}

func (r *VisitorPermitRepository) GetActiveContractForTenant(ctx context.Context, propertyID, tenantID uuid.UUID) (*model.Contract, error) {
	query := `
		SELECT c.id, c.property_id, c.room_id, c.user_id, c.start_date, c.end_date, c.status
		FROM contracts c
		WHERE c.property_id = $1 AND c.user_id = $2 AND c.status = 'active'
		ORDER BY c.created_at DESC
		LIMIT 1
	`
	var c model.Contract
	var roomID *uuid.UUID
	var userID *uuid.UUID
	err := r.db.QueryRow(ctx, query, propertyID, tenantID).Scan(
		&c.ID, &c.PropertyID, &roomID, &userID, &c.StartDate, &c.EndDate, &c.Status,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrActiveContractNotFound
		}
		return nil, fmt.Errorf("query active contract: %w", err)
	}
	c.RoomID = roomID
	c.UserID = userID
	return &c, nil
}

func (r *VisitorPermitRepository) FindActiveContractAnyProperty(ctx context.Context, tenantID uuid.UUID) (*model.Contract, error) {
	query := `
		SELECT c.id, c.property_id, c.room_id, c.user_id, c.start_date, c.end_date, c.status
		FROM contracts c
		WHERE c.user_id = $1 AND c.status = 'active'
		ORDER BY c.created_at DESC
		LIMIT 1
	`
	var c model.Contract
	var roomID *uuid.UUID
	var userID *uuid.UUID
	err := r.db.QueryRow(ctx, query, tenantID).Scan(
		&c.ID, &c.PropertyID, &roomID, &userID, &c.StartDate, &c.EndDate, &c.Status,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrActiveContractNotFound
		}
		return nil, fmt.Errorf("query tenant active contract: %w", err)
	}
	c.RoomID = roomID
	c.UserID = userID
	return &c, nil
}

func (r *VisitorPermitRepository) Create(ctx context.Context, permit *model.VisitorPermit) (*model.VisitorPermit, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	permitID := uuid.New()
	permit.ID = permitID
	permit.Status = model.VisitorPermitStatusPending
	permit.CreatedAt = time.Now()
	permit.UpdatedAt = time.Now()

	insertQuery := `
		INSERT INTO visitor_permits (
			id, property_id, tenant_id, contract_id, room_id,
			guest_name, guest_phone, guest_id_card_last4, relationship, purpose,
			is_overnight, start_time, end_time, total_guests, vehicle_type, vehicle_number,
			status, is_anonymized, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16,
			$17, FALSE, $18, $19
		)
	`
	_, err = tx.Exec(ctx, insertQuery,
		permit.ID, permit.PropertyID, permit.TenantID, permit.ContractID, permit.RoomID,
		permit.GuestName, permit.GuestPhone, permit.GuestIDCardLast4, permit.Relationship, permit.Purpose,
		permit.IsOvernight, permit.StartTime, permit.EndTime, permit.TotalGuests, permit.VehicleType, permit.VehicleNumber,
		permit.Status, permit.CreatedAt, permit.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert visitor permit: %w", err)
	}

	// Record submission audit event
	payloadJSON, _ := json.Marshal(map[string]any{
		"guest_name":   permit.GuestName,
		"is_overnight": permit.IsOvernight,
		"start_time":   permit.StartTime,
		"end_time":     permit.EndTime,
		"total_guests": permit.TotalGuests,
	})
	eventQuery := `
		INSERT INTO visitor_permit_events (
			id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, 'tenant', 'submitted', 'Permintaan izin tamu diajukan', $4, NOW()
		)
	`
	_, err = tx.Exec(ctx, eventQuery, permit.ID, permit.PropertyID, permit.TenantID, payloadJSON)
	if err != nil {
		return nil, fmt.Errorf("insert visitor permit event: %w", err)
	}

	// Insert into notification_outbox for property manager/owner
	outboxPayload, _ := json.Marshal(map[string]any{
		"permit_id":    permit.ID,
		"property_id":  permit.PropertyID,
		"tenant_id":    permit.TenantID,
		"guest_name":   permit.GuestName,
		"is_overnight": permit.IsOvernight,
		"event":        "visitor_permit_submitted",
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload, status)
		VALUES ($1, 'visitor_permit_submitted', 'visitor_permit', $2, $3, 'pending')
	`, permit.PropertyID, permit.ID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, permit.PropertyID, permit.ID)
}

const selectPermitBase = `
	SELECT p.id, p.property_id, p.tenant_id, p.contract_id, p.room_id,
	       p.guest_name, p.guest_phone, p.guest_id_card_last4, p.relationship, p.purpose,
	       p.is_overnight, p.start_time, p.end_time, p.total_guests, p.vehicle_type, p.vehicle_number,
	       p.status, p.pass_token, p.reviewed_by, p.reviewed_at, p.review_notes,
	       p.checked_in_by, p.checked_in_at, p.checked_out_by, p.checked_out_at,
	       p.is_anonymized, p.anonymized_at, p.created_at, p.updated_at,
	       COALESCE(u.name, '') AS tenant_name,
	       COALESCE(u.phone, '') AS tenant_phone,
	       COALESCE(r.room_number, '') AS room_number,
	       COALESCE(pr.name, '') AS property_name
	FROM visitor_permits p
	LEFT JOIN users u ON u.id = p.tenant_id
	LEFT JOIN rooms r ON r.id = p.room_id
	LEFT JOIN properties pr ON pr.id = p.property_id
`

func scanVisitorPermit(row pgx.Row) (*model.VisitorPermit, error) {
	var p model.VisitorPermit
	var statusStr string
	err := row.Scan(
		&p.ID, &p.PropertyID, &p.TenantID, &p.ContractID, &p.RoomID,
		&p.GuestName, &p.GuestPhone, &p.GuestIDCardLast4, &p.Relationship, &p.Purpose,
		&p.IsOvernight, &p.StartTime, &p.EndTime, &p.TotalGuests, &p.VehicleType, &p.VehicleNumber,
		&statusStr, &p.PassToken, &p.ReviewedBy, &p.ReviewedAt, &p.ReviewNotes,
		&p.CheckedInBy, &p.CheckedInAt, &p.CheckedOutBy, &p.CheckedOutAt,
		&p.IsAnonymized, &p.AnonymizedAt, &p.CreatedAt, &p.UpdatedAt,
		&p.TenantName, &p.TenantPhone, &p.RoomNumber, &p.PropertyName,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVisitorPermitNotFound
		}
		return nil, err
	}
	p.Status = model.VisitorPermitStatus(statusStr)
	p.IsOverstay = (p.Status == model.VisitorPermitStatusActive && time.Now().After(p.EndTime))
	return &p, nil
}

func (r *VisitorPermitRepository) GetByID(ctx context.Context, propertyID, id uuid.UUID) (*model.VisitorPermit, error) {
	query := selectPermitBase + ` WHERE p.property_id = $1 AND p.id = $2 `
	return scanVisitorPermit(r.db.QueryRow(ctx, query, propertyID, id))
}

func (r *VisitorPermitRepository) GetByIDForTenant(ctx context.Context, tenantID, id uuid.UUID) (*model.VisitorPermit, error) {
	query := selectPermitBase + ` WHERE p.tenant_id = $1 AND p.id = $2 `
	return scanVisitorPermit(r.db.QueryRow(ctx, query, tenantID, id))
}

func (r *VisitorPermitRepository) GetByPassToken(ctx context.Context, token string) (*model.VisitorPassVerification, error) {
	query := `
		SELECT p.pass_token, pr.name, r.room_number, p.guest_name, p.relationship, p.purpose,
		       p.is_overnight, p.start_time, p.end_time, p.total_guests, p.vehicle_type, p.vehicle_number,
		       p.status, p.checked_in_at, p.checked_out_at
		FROM visitor_permits p
		LEFT JOIN rooms r ON r.id = p.room_id
		LEFT JOIN properties pr ON pr.id = p.property_id
		WHERE p.pass_token = $1
	`
	var passToken, propName, roomNum, guestName, rel, purpose, vehicleType, status string
	var isOvernight bool
	var startTime, endTime time.Time
	var totalGuests int
	var vehicleNum *string
	var checkedInAt, checkedOutAt *time.Time

	err := r.db.QueryRow(ctx, query, token).Scan(
		&passToken, &propName, &roomNum, &guestName, &rel, &purpose,
		&isOvernight, &startTime, &endTime, &totalGuests, &vehicleType, &vehicleNum,
		&status, &checkedInAt, &checkedOutAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrVisitorPermitNotFound
		}
		return nil, fmt.Errorf("scan visitor pass: %w", err)
	}

	maskedName := maskGuestName(guestName)
	now := time.Now()
	isValid := (status == string(model.VisitorPermitStatusApproved) || status == string(model.VisitorPermitStatusActive)) &&
		now.After(startTime.Add(-2*time.Hour)) && now.Before(endTime.Add(2*time.Hour))
	isOverstay := status == string(model.VisitorPermitStatusActive) && now.After(endTime)

	return &model.VisitorPassVerification{
		PassToken:       passToken,
		PropertyName:    propName,
		RoomNumber:      roomNum,
		GuestNameMasked: maskedName,
		Relationship:    rel,
		Purpose:         purpose,
		IsOvernight:     isOvernight,
		StartTime:       startTime,
		EndTime:         endTime,
		TotalGuests:     totalGuests,
		VehicleType:     vehicleType,
		VehicleNumber:   vehicleNum,
		Status:          status,
		IsValid:         isValid,
		IsOverstay:      isOverstay,
		CheckedInAt:     checkedInAt,
		CheckedOutAt:    checkedOutAt,
	}, nil
}

func maskGuestName(name string) string {
	words := strings.Fields(name)
	if len(words) == 0 {
		return "Tamu"
	}
	var masked []string
	for _, w := range words {
		runes := []rune(w)
		if len(runes) <= 1 {
			masked = append(masked, string(runes))
		} else {
			masked = append(masked, string(runes[0])+"***")
		}
	}
	return strings.Join(masked, " ")
}

func (r *VisitorPermitRepository) List(ctx context.Context, filter model.VisitorPermitFilter) ([]*model.VisitorPermit, int, error) {
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("p.property_id = $%d", argIdx))
	args = append(args, filter.PropertyID)
	argIdx++

	if filter.TenantID != nil {
		conditions = append(conditions, fmt.Sprintf("p.tenant_id = $%d", argIdx))
		args = append(args, *filter.TenantID)
		argIdx++
	}

	if filter.Status != "" && filter.Status != "all" {
		conditions = append(conditions, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("p.start_time >= $%d", argIdx))
		args = append(args, *filter.StartDate)
		argIdx++
	}

	if filter.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("p.end_time <= $%d", argIdx))
		args = append(args, *filter.EndDate)
		argIdx++
	}

	if filter.IsOvernight != nil {
		conditions = append(conditions, fmt.Sprintf("p.is_overnight = $%d", argIdx))
		args = append(args, *filter.IsOvernight)
		argIdx++
	}

	if filter.Search != "" {
		pattern := "%" + strings.ToLower(filter.Search) + "%"
		conditions = append(conditions, fmt.Sprintf(
			"(LOWER(p.guest_name) LIKE $%d OR LOWER(COALESCE(p.vehicle_number, '')) LIKE $%d OR LOWER(COALESCE(r.room_number, '')) LIKE $%d OR LOWER(COALESCE(u.name, '')) LIKE $%d)",
			argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, pattern)
		argIdx++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	countQuery := `
		SELECT COUNT(*)
		FROM visitor_permits p
		LEFT JOIN users u ON u.id = p.tenant_id
		LEFT JOIN rooms r ON r.id = p.room_id
	` + whereClause

	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count visitor permits: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := selectPermitBase + whereClause + fmt.Sprintf(" ORDER BY p.created_at DESC LIMIT %d OFFSET %d", limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query visitor permits: %w", err)
	}
	defer rows.Close()

	var permits []*model.VisitorPermit
	for rows.Next() {
		p, err := scanVisitorPermit(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan visitor permit item: %w", err)
		}
		permits = append(permits, p)
	}
	return permits, total, nil
}

func (r *VisitorPermitRepository) ListForTenant(ctx context.Context, tenantID uuid.UUID, filter model.VisitorPermitFilter) ([]*model.VisitorPermit, int, error) {
	filter.TenantID = &tenantID
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("p.tenant_id = $%d", argIdx))
	args = append(args, tenantID)
	argIdx++

	if filter.PropertyID != uuid.Nil {
		conditions = append(conditions, fmt.Sprintf("p.property_id = $%d", argIdx))
		args = append(args, filter.PropertyID)
		argIdx++
	}

	if filter.Status != "" && filter.Status != "all" {
		conditions = append(conditions, fmt.Sprintf("p.status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}

	if filter.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("p.start_time >= $%d", argIdx))
		args = append(args, *filter.StartDate)
		argIdx++
	}

	if filter.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("p.end_time <= $%d", argIdx))
		args = append(args, *filter.EndDate)
		argIdx++
	}

	whereClause := "WHERE " + strings.Join(conditions, " AND ")

	countQuery := `
		SELECT COUNT(*)
		FROM visitor_permits p
	` + whereClause

	var total int
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count tenant visitor permits: %w", err)
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := selectPermitBase + whereClause + fmt.Sprintf(" ORDER BY p.created_at DESC LIMIT %d OFFSET %d", limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query tenant visitor permits: %w", err)
	}
	defer rows.Close()

	var permits []*model.VisitorPermit
	for rows.Next() {
		p, err := scanVisitorPermit(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("scan tenant visitor permit item: %w", err)
		}
		permits = append(permits, p)
	}
	return permits, total, nil
}

func (r *VisitorPermitRepository) UpdateStatus(
	ctx context.Context,
	propertyID, permitID, actorID uuid.UUID,
	actorRole string,
	newStatus model.VisitorPermitStatus,
	reason string,
) (*model.VisitorPermit, error) {
	current, err := r.GetByID(ctx, propertyID, permitID)
	if err != nil {
		return nil, err
	}

	if current.Status == model.VisitorPermitStatusCompleted || current.Status == model.VisitorPermitStatusCancelled {
		return nil, ErrPermitCancelledOrExpired
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	var passToken *string = current.PassToken
	if newStatus == model.VisitorPermitStatusApproved && (passToken == nil || *passToken == "") {
		tok := generatePassToken()
		passToken = &tok
	}

	now := time.Now()
	updateQuery := `
		UPDATE visitor_permits
		SET status = $1, reviewed_by = $2, reviewed_at = $3, review_notes = $4, pass_token = $5, updated_at = $6
		WHERE id = $7 AND property_id = $8
	`
	_, err = tx.Exec(ctx, updateQuery, newStatus, actorID, now, reason, passToken, now, permitID, propertyID)
	if err != nil {
		return nil, fmt.Errorf("update permit status: %w", err)
	}

	// Insert audit event
	payloadJSON, _ := json.Marshal(map[string]any{
		"previous_status": current.Status,
		"new_status":      newStatus,
		"reason":          reason,
	})
	eventType := model.VisitorPermitEventType(string(newStatus))
	_, err = tx.Exec(ctx, `
		INSERT INTO visitor_permit_events (
			id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW()
		)
	`, permitID, propertyID, actorID, actorRole, eventType, reason, payloadJSON)
	if err != nil {
		return nil, fmt.Errorf("insert permit event: %w", err)
	}

	// Notify tenant via outbox & in_app
	notifTitle := fmt.Sprintf("Izin Tamu %s", strings.ToUpper(string(newStatus)))
	notifMsg := fmt.Sprintf("Permintaan izin tamu (%s) telah diperbarui menjadi %s. Catatan: %s", current.GuestName, newStatus, reason)
	if reason == "" {
		notifMsg = fmt.Sprintf("Permintaan izin tamu (%s) telah disetujui.", current.GuestName)
	}

	_, _ = tx.Exec(ctx, `
		INSERT INTO in_app_notifications (property_id, user_id, category, title, message, action_url, metadata)
		VALUES ($1, $2, 'operations', $3, $4, '/guest-permits', $5)
	`, propertyID, current.TenantID, notifTitle, notifMsg, payloadJSON)

	outboxPayload, _ := json.Marshal(map[string]any{
		"permit_id":   permitID,
		"tenant_id":   current.TenantID,
		"status":      newStatus,
		"reason":      reason,
		"event":       "visitor_permit_reviewed",
		"title":       notifTitle,
		"message":     notifMsg,
	})
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, recipient_id, event_type, aggregate_type, aggregate_id, payload, status)
		VALUES ($1, $2, 'visitor_permit_reviewed', 'visitor_permit', $3, $4, 'pending')
	`, propertyID, current.TenantID, permitID, outboxPayload)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, propertyID, permitID)
}

func (r *VisitorPermitRepository) CheckIn(
	ctx context.Context,
	propertyID, permitID, actorID uuid.UUID,
	actorRole string,
) (*model.VisitorPermit, error) {
	current, err := r.GetByID(ctx, propertyID, permitID)
	if err != nil {
		return nil, err
	}
	if current.Status != model.VisitorPermitStatusApproved && current.Status != model.VisitorPermitStatusActive {
		return nil, errors.New("hanya izin tamu yang telah disetujui yang dapat di-check-in")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE visitor_permits
		SET status = 'active', checked_in_by = $1, checked_in_at = $2, updated_at = $2
		WHERE id = $3 AND property_id = $4
	`, actorID, now, permitID, propertyID)
	if err != nil {
		return nil, fmt.Errorf("update check in: %w", err)
	}

	payloadJSON, _ := json.Marshal(map[string]any{
		"checked_in_at": now,
	})
	_, err = tx.Exec(ctx, `
		INSERT INTO visitor_permit_events (
			id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, 'checked_in', 'Tamu telah check-in di lokasi', $5, NOW()
		)
	`, permitID, propertyID, actorID, actorRole, payloadJSON)
	if err != nil {
		return nil, fmt.Errorf("insert check in event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, propertyID, permitID)
}

func (r *VisitorPermitRepository) CheckOut(
	ctx context.Context,
	propertyID, permitID, actorID uuid.UUID,
	actorRole string,
) (*model.VisitorPermit, error) {
	current, err := r.GetByID(ctx, propertyID, permitID)
	if err != nil {
		return nil, err
	}
	if current.Status != model.VisitorPermitStatusActive && current.Status != model.VisitorPermitStatusApproved {
		return nil, errors.New("hanya izin tamu aktif atau disetujui yang dapat di-check-out")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE visitor_permits
		SET status = 'completed', checked_out_by = $1, checked_out_at = $2, updated_at = $2
		WHERE id = $3 AND property_id = $4
	`, actorID, now, permitID, propertyID)
	if err != nil {
		return nil, fmt.Errorf("update check out: %w", err)
	}

	payloadJSON, _ := json.Marshal(map[string]any{
		"checked_out_at": now,
	})
	_, err = tx.Exec(ctx, `
		INSERT INTO visitor_permit_events (
			id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, 'checked_out', 'Tamu telah check-out dan meninggalkan properti', $5, NOW()
		)
	`, permitID, propertyID, actorID, actorRole, payloadJSON)
	if err != nil {
		return nil, fmt.Errorf("insert check out event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByID(ctx, propertyID, permitID)
}

func (r *VisitorPermitRepository) Cancel(
	ctx context.Context,
	permitID, tenantID uuid.UUID,
	reason string,
) (*model.VisitorPermit, error) {
	current, err := r.GetByIDForTenant(ctx, tenantID, permitID)
	if err != nil {
		return nil, err
	}

	if current.Status != model.VisitorPermitStatusPending && current.Status != model.VisitorPermitStatusChangeRequested {
		return nil, errors.New("hanya izin tamu berstatus pending atau butuh perubahan yang dapat dibatalkan penyewa")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	now := time.Now()
	_, err = tx.Exec(ctx, `
		UPDATE visitor_permits
		SET status = 'cancelled', updated_at = $1
		WHERE id = $2 AND tenant_id = $3
	`, now, permitID, tenantID)
	if err != nil {
		return nil, fmt.Errorf("cancel permit: %w", err)
	}

	payloadJSON, _ := json.Marshal(map[string]any{
		"reason": reason,
	})
	_, err = tx.Exec(ctx, `
		INSERT INTO visitor_permit_events (
			id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, 'tenant', 'cancelled', $4, $5, NOW()
		)
	`, permitID, current.PropertyID, tenantID, reason, payloadJSON)
	if err != nil {
		return nil, fmt.Errorf("insert cancel event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit tx: %w", err)
	}

	return r.GetByIDForTenant(ctx, tenantID, permitID)
}

func (r *VisitorPermitRepository) GetEvents(ctx context.Context, permitID uuid.UUID) ([]*model.VisitorPermitEvent, error) {
	query := `
		SELECT e.id, e.visitor_permit_id, e.property_id, e.actor_id, e.actor_role,
		       e.event_type, e.reason, e.payload, e.created_at,
		       COALESCE(u.name, '') AS actor_name
		FROM visitor_permit_events e
		LEFT JOIN users u ON u.id = e.actor_id
		WHERE e.visitor_permit_id = $1
		ORDER BY e.created_at ASC
	`
	rows, err := r.db.Query(ctx, query, permitID)
	if err != nil {
		return nil, fmt.Errorf("query permit events: %w", err)
	}
	defer rows.Close()

	var events []*model.VisitorPermitEvent
	for rows.Next() {
		var ev model.VisitorPermitEvent
		var eventTypeStr string
		var payloadBytes []byte
		err := rows.Scan(
			&ev.ID, &ev.VisitorPermitID, &ev.PropertyID, &ev.ActorID, &ev.ActorRole,
			&eventTypeStr, &ev.Reason, &payloadBytes, &ev.CreatedAt,
			&ev.ActorName,
		)
		if err != nil {
			return nil, fmt.Errorf("scan permit event: %w", err)
		}
		ev.EventType = model.VisitorPermitEventType(eventTypeStr)
		if len(payloadBytes) > 0 {
			_ = json.Unmarshal(payloadBytes, &ev.Payload)
		}
		events = append(events, &ev)
	}
	return events, nil
}

func (r *VisitorPermitRepository) GetSummary(ctx context.Context, propertyID uuid.UUID) (*model.VisitorPermitSummary, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	query := `
		SELECT
			COUNT(*) FILTER (WHERE start_time < $3 AND end_time > $2) AS total_today,
			COUNT(*) FILTER (WHERE status = 'active') AS active_count,
			COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
			COUNT(*) FILTER (WHERE status = 'active' AND end_time < NOW()) AS overstay_count,
			COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count
		FROM visitor_permits
		WHERE property_id = $1
	`
	var s model.VisitorPermitSummary
	err := r.db.QueryRow(ctx, query, propertyID, startOfDay, endOfDay).Scan(
		&s.TotalToday, &s.ActiveCount, &s.PendingCount, &s.OverstayCount, &s.RejectedCount,
	)
	if err != nil {
		return nil, fmt.Errorf("query permit summary: %w", err)
	}
	return &s, nil
}

func (r *VisitorPermitRepository) ApplyRetention(ctx context.Context, propertyID uuid.UUID, olderThanDays int) (int64, error) {
	if olderThanDays <= 0 {
		olderThanDays = 30
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Anonymize guest PII for finalized records older than retention period
	cutoff := time.Now().AddDate(0, 0, -olderThanDays)
	query := `
		UPDATE visitor_permits
		SET is_anonymized = TRUE,
		    anonymized_at = NOW(),
		    guest_name = 'Tamu (Dianonimkan)',
		    guest_phone = NULL,
		    guest_id_card_last4 = NULL,
		    vehicle_number = NULL,
		    updated_at = NOW()
		WHERE property_id = $1
		  AND is_anonymized = FALSE
		  AND status IN ('completed', 'rejected', 'cancelled', 'expired')
		  AND updated_at < $2
	`
	cmdTag, err := tx.Exec(ctx, query, propertyID, cutoff)
	if err != nil {
		return 0, fmt.Errorf("execute retention anonymization: %w", err)
	}
	rowsAffected := cmdTag.RowsAffected()

	if rowsAffected > 0 {
		_, _ = tx.Exec(ctx, `
			INSERT INTO visitor_permit_events (
				id, visitor_permit_id, property_id, actor_id, actor_role, event_type, reason, payload, created_at
			)
			SELECT gen_random_uuid(), id, property_id, NULL, 'system', 'anonymized', 'Data PII tamu dianonimkan sesuai kebijakan retensi', '{}'::jsonb, NOW()
			FROM visitor_permits
			WHERE property_id = $1 AND anonymized_at >= NOW() - interval '5 seconds'
		`, propertyID)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit retention tx: %w", err)
	}

	return rowsAffected, nil
}
