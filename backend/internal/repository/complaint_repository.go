package repository

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ComplaintRepository struct {
	db *pgxpool.Pool
}

func NewComplaintRepository(db *pgxpool.Pool) *ComplaintRepository {
	return &ComplaintRepository{db: db}
}

// DB returns the underlying connection pool.
func (r *ComplaintRepository) DB() *pgxpool.Pool {
	return r.db
}

// FindActiveContractByTenantUser derives the support tenancy boundary from an
// authenticated tenant's active contract.
func (r *ComplaintRepository) FindActiveContractByTenantUser(ctx context.Context, userID uuid.UUID) (roomID, ownerID, propertyID uuid.UUID, err error) {
	query := `
		SELECT c.room_id, c.owner_id, c.property_id
		FROM contracts c
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		WHERE c.user_id = $1 AND c.status = 'active'
		ORDER BY c.created_at DESC
		LIMIT 1`
	err = r.db.QueryRow(ctx, query, userID).Scan(&roomID, &ownerID, &propertyID)
	return
}

// Create stores a new complaint with SLA due targets and writes the initial timeline event.
func (r *ComplaintRepository) Create(ctx context.Context, complaint *model.Complaint) error {
	now := time.Now()
	if complaint.Priority == "" {
		complaint.Priority = model.ComplaintPriorityMedium
	}
	if complaint.Impact == "" {
		complaint.Impact = model.ComplaintImpactMinor
	}
	if complaint.Status == "" {
		complaint.Status = model.ComplaintStatusPending
	}
	if complaint.SLAStatus == "" {
		complaint.SLAStatus = model.SLAStatusWithinSLA
	}

	firstDue, resDue := model.CalculateDefaultSLADueDates(now, complaint.Priority, complaint.Impact)
	complaint.FirstResponseDueAt = &firstDue
	complaint.ResolutionDueAt = &resDue

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO complaints (
			property_id, user_id, owner_id, room_id, title, description,
			category, priority, impact, status, access_window, preferred_contact,
			photo_url, ai_response, wa_sent, wa_message,
			first_response_due_at, resolution_due_at, sla_status,
			created_at, updated_at
		)
		SELECT
			c.property_id, c.user_id, c.owner_id, c.room_id,
			$5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20
		FROM contracts c
		WHERE c.user_id = $1
		  AND c.property_id = $2
		  AND c.room_id = $3
		  AND c.owner_id = $4
		  AND c.status = 'active'
		ORDER BY c.created_at DESC
		LIMIT 1
		RETURNING id, property_id, created_at, updated_at`

	err = tx.QueryRow(ctx, query,
		complaint.UserID, complaint.PropertyID, complaint.RoomID, complaint.OwnerID,
		complaint.Title, complaint.Description, complaint.Category, complaint.Priority, complaint.Impact,
		complaint.Status, complaint.AccessWindow, complaint.PreferredContact,
		complaint.PhotoURL, complaint.AIResponse, complaint.WASent, complaint.WAMessage,
		complaint.FirstResponseDueAt, complaint.ResolutionDueAt, complaint.SLAStatus, now,
	).Scan(&complaint.ID, &complaint.PropertyID, &complaint.CreatedAt, &complaint.UpdatedAt)
	if err != nil {
		return err
	}

	// Insert initial created event
	initEventMsg := "Komplain berhasil dilaporkan oleh penyewa."
	if complaint.Priority == model.ComplaintPriorityUrgent {
		initEventMsg = "Komplain prioritas TINGGI/DARURAT dilaporkan oleh penyewa."
	}
	eventPayload, _ := json.Marshal(map[string]interface{}{
		"category": complaint.Category,
		"priority": complaint.Priority,
		"impact":   complaint.Impact,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		complaint.ID, complaint.PropertyID, complaint.UserID, "Penyewa", "tenant",
		"created", model.EventVisibilityPublic, initEventMsg, eventPayload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// FindByID retrieves a complaint by its ID and property scope.
func (r *ComplaintRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.priority, c.impact, c.status,
			c.access_window, c.preferred_contact, c.assigned_to,
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message,
			c.first_response_at, c.resolved_at, c.confirmed_resolved_at, c.reopened_at,
			c.first_response_due_at, c.resolution_due_at, c.sla_status,
			c.created_at, c.updated_at,
			rm.room_number, u.name AS user_name,
			COALESCE(assignee.name, '') AS assignee_name,
			(SELECT COUNT(*) FROM work_orders wo WHERE wo.complaint_id = c.id) AS work_orders_count,
			EXISTS (SELECT 1 FROM ai_suggestions ai WHERE ai.complaint_id = c.id) AS has_ai_suggestion
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		LEFT JOIN users assignee ON assignee.id = c.assigned_to
		WHERE c.id = $1 AND c.property_id = $2`

	var c model.Complaint
	err := r.db.QueryRow(ctx, query, id, propertyID).Scan(
		&c.ID, &c.PropertyID, &c.UserID, &c.OwnerID, &c.RoomID,
		&c.Title, &c.Description, &c.Category, &c.Priority, &c.Impact, &c.Status,
		&c.AccessWindow, &c.PreferredContact, &c.AssignedTo,
		&c.PhotoURL, &c.AIResponse, &c.WASent, &c.WAMessage,
		&c.FirstResponseAt, &c.ResolvedAt, &c.ConfirmedResolvedAt, &c.ReopenedAt,
		&c.FirstResponseDueAt, &c.ResolutionDueAt, &c.SLAStatus,
		&c.CreatedAt, &c.UpdatedAt,
		&c.RoomNumber, &c.UserName, &c.AssigneeName,
		&c.WorkOrdersCount, &c.HasAISuggestion,
	)
	if err != nil {
		return nil, err
	}

	// Update SLA status dynamically if pending/in_progress
	c.SLAStatus = model.EvaluateSLAStatus(time.Now(), c.Status, c.FirstResponseAt, c.ResolvedAt, c.FirstResponseDueAt, c.ResolutionDueAt)
	return &c, nil
}

// FindByTenantAndID retrieves a complaint scoped to the tenant.
func (r *ComplaintRepository) FindByTenantAndID(ctx context.Context, id, userID uuid.UUID) (*model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.priority, c.impact, c.status,
			c.access_window, c.preferred_contact, c.assigned_to,
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message,
			c.first_response_at, c.resolved_at, c.confirmed_resolved_at, c.reopened_at,
			c.first_response_due_at, c.resolution_due_at, c.sla_status,
			c.created_at, c.updated_at,
			rm.room_number, u.name AS user_name,
			COALESCE(assignee.name, '') AS assignee_name,
			(SELECT COUNT(*) FROM work_orders wo WHERE wo.complaint_id = c.id) AS work_orders_count,
			EXISTS (SELECT 1 FROM ai_suggestions ai WHERE ai.complaint_id = c.id) AS has_ai_suggestion
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		LEFT JOIN users assignee ON assignee.id = c.assigned_to
		WHERE c.id = $1 AND c.user_id = $2`

	var c model.Complaint
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&c.ID, &c.PropertyID, &c.UserID, &c.OwnerID, &c.RoomID,
		&c.Title, &c.Description, &c.Category, &c.Priority, &c.Impact, &c.Status,
		&c.AccessWindow, &c.PreferredContact, &c.AssignedTo,
		&c.PhotoURL, &c.AIResponse, &c.WASent, &c.WAMessage,
		&c.FirstResponseAt, &c.ResolvedAt, &c.ConfirmedResolvedAt, &c.ReopenedAt,
		&c.FirstResponseDueAt, &c.ResolutionDueAt, &c.SLAStatus,
		&c.CreatedAt, &c.UpdatedAt,
		&c.RoomNumber, &c.UserName, &c.AssigneeName,
		&c.WorkOrdersCount, &c.HasAISuggestion,
	)
	if err != nil {
		return nil, err
	}
	c.SLAStatus = model.EvaluateSLAStatus(time.Now(), c.Status, c.FirstResponseAt, c.ResolvedAt, c.FirstResponseDueAt, c.ResolutionDueAt)
	return &c, nil
}

// FindByTenant lists all complaints filed by a tenant.
func (r *ComplaintRepository) FindByTenant(ctx context.Context, userID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.priority, c.impact, c.status,
			c.access_window, c.preferred_contact, c.assigned_to,
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message,
			c.first_response_at, c.resolved_at, c.confirmed_resolved_at, c.reopened_at,
			c.first_response_due_at, c.resolution_due_at, c.sla_status,
			c.created_at, c.updated_at,
			rm.room_number, u.name AS user_name,
			COALESCE(assignee.name, '') AS assignee_name,
			(SELECT COUNT(*) FROM work_orders wo WHERE wo.complaint_id = c.id) AS work_orders_count,
			EXISTS (SELECT 1 FROM ai_suggestions ai WHERE ai.complaint_id = c.id) AS has_ai_suggestion
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		LEFT JOIN users assignee ON assignee.id = c.assigned_to
		WHERE c.user_id = $1
		ORDER BY c.created_at DESC`

	return r.queryComplaints(ctx, query, userID)
}

// FindByProperty lists complaints for a property, with optional priority and status filtering.
func (r *ComplaintRepository) FindByProperty(ctx context.Context, propertyID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.priority, c.impact, c.status,
			c.access_window, c.preferred_contact, c.assigned_to,
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message,
			c.first_response_at, c.resolved_at, c.confirmed_resolved_at, c.reopened_at,
			c.first_response_due_at, c.resolution_due_at, c.sla_status,
			c.created_at, c.updated_at,
			rm.room_number, u.name AS user_name,
			COALESCE(assignee.name, '') AS assignee_name,
			(SELECT COUNT(*) FROM work_orders wo WHERE wo.complaint_id = c.id) AS work_orders_count,
			EXISTS (SELECT 1 FROM ai_suggestions ai WHERE ai.complaint_id = c.id) AS has_ai_suggestion
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		LEFT JOIN users assignee ON assignee.id = c.assigned_to
		WHERE c.property_id = $1
		ORDER BY
			CASE c.priority
				WHEN 'urgent' THEN 1
				WHEN 'high' THEN 2
				WHEN 'medium' THEN 3
				WHEN 'low' THEN 4
				ELSE 5
			END ASC,
			c.created_at DESC`

	return r.queryComplaints(ctx, query, propertyID)
}

func (r *ComplaintRepository) queryComplaints(ctx context.Context, query string, arg uuid.UUID) ([]model.Complaint, error) {
	rows, err := r.db.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	complaints := make([]model.Complaint, 0)
	now := time.Now()
	for rows.Next() {
		var c model.Complaint
		if err := rows.Scan(
			&c.ID, &c.PropertyID, &c.UserID, &c.OwnerID, &c.RoomID,
			&c.Title, &c.Description, &c.Category, &c.Priority, &c.Impact, &c.Status,
			&c.AccessWindow, &c.PreferredContact, &c.AssignedTo,
			&c.PhotoURL, &c.AIResponse, &c.WASent, &c.WAMessage,
			&c.FirstResponseAt, &c.ResolvedAt, &c.ConfirmedResolvedAt, &c.ReopenedAt,
			&c.FirstResponseDueAt, &c.ResolutionDueAt, &c.SLAStatus,
			&c.CreatedAt, &c.UpdatedAt,
			&c.RoomNumber, &c.UserName, &c.AssigneeName,
			&c.WorkOrdersCount, &c.HasAISuggestion,
		); err != nil {
			return nil, err
		}
		c.SLAStatus = model.EvaluateSLAStatus(now, c.Status, c.FirstResponseAt, c.ResolvedAt, c.FirstResponseDueAt, c.ResolutionDueAt)
		complaints = append(complaints, c)
	}
	return complaints, rows.Err()
}

// UpdateStatus changes complaint status and records timeline event and SLA timestamps.
func (r *ComplaintRepository) UpdateStatus(ctx context.Context, id, propertyID uuid.UUID, status string, actorID *uuid.UUID, actorName, actorRole string, notes *string) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var firstResponseAt, resolvedAt *time.Time
	var oldStatus string
	err = tx.QueryRow(ctx, `
		SELECT status, first_response_at, resolved_at
		FROM complaints WHERE id = $1 AND property_id = $2 FOR UPDATE`, id, propertyID,
	).Scan(&oldStatus, &firstResponseAt, &resolvedAt)
	if err != nil {
		return err
	}

	setFirstResponse := firstResponseAt == nil && actorRole != "tenant"
	setResolved := status == model.ComplaintStatusResolved

	query := `
		UPDATE complaints
		SET status = $1,
			first_response_at = CASE WHEN $4 = true THEN $5 ELSE first_response_at END,
			resolved_at = CASE WHEN $6 = true THEN $5 ELSE resolved_at END,
			updated_at = $5
		WHERE id = $2 AND property_id = $3`

	tag, err := tx.Exec(ctx, query, status, id, propertyID, setFirstResponse, now, setResolved)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	msg := "Status komplain diperbarui menjadi: " + status
	if notes != nil && *notes != "" {
		msg += " - Catatan: " + *notes
	}

	eventPayload, _ := json.Marshal(map[string]interface{}{
		"old_status": oldStatus,
		"new_status": status,
		"notes":      notes,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, propertyID, actorID, actorName, actorRole,
		"status_changed", model.EventVisibilityPublic, msg, eventPayload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// Triage sets priority, impact, access window, and SLA deadlines.
func (r *ComplaintRepository) Triage(ctx context.Context, id, propertyID uuid.UUID, priority, impact string, accessWindow *string, firstResponseDue, resolutionDue *time.Time, actorID *uuid.UUID, actorName, actorRole string, reason *string) error {
	now := time.Now()
	if firstResponseDue == nil || resolutionDue == nil {
		d1, d2 := model.CalculateDefaultSLADueDates(now, priority, impact)
		if firstResponseDue == nil {
			firstResponseDue = &d1
		}
		if resolutionDue == nil {
			resolutionDue = &d2
		}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE complaints
		SET priority = $1,
			impact = $2,
			access_window = COALESCE($3, access_window),
			first_response_due_at = $4,
			resolution_due_at = $5,
			updated_at = $6
		WHERE id = $7 AND property_id = $8`,
		priority, impact, accessWindow, firstResponseDue, resolutionDue, now, id, propertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	msg := "Tiket ditriage: Prioritas = " + priority + ", Dampak = " + impact
	if reason != nil && *reason != "" {
		msg += " (" + *reason + ")"
	}

	eventPayload, _ := json.Marshal(map[string]interface{}{
		"priority":               priority,
		"impact":                 impact,
		"first_response_due_at": firstResponseDue,
		"resolution_due_at":     resolutionDue,
		"reason":                 reason,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, propertyID, actorID, actorName, actorRole,
		"triaged", model.EventVisibilityPublic, msg, eventPayload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// Assign assigns a PIC to the complaint and sets first_response_at if not set.
func (r *ComplaintRepository) Assign(ctx context.Context, id, propertyID uuid.UUID, assignedTo *uuid.UUID, actorID *uuid.UUID, actorName, actorRole string, notes *string) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var assigneeName string
	if assignedTo != nil {
		err = tx.QueryRow(ctx, `SELECT name FROM users WHERE id = $1`, *assignedTo).Scan(&assigneeName)
		if err != nil {
			return errors.New("petugas penanggung jawab tidak ditemukan")
		}
	}

	tag, err := tx.Exec(ctx, `
		UPDATE complaints
		SET assigned_to = $1,
			first_response_at = COALESCE(first_response_at, $2),
			status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END,
			updated_at = $2
		WHERE id = $3 AND property_id = $4`,
		assignedTo, now, id, propertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	msg := "Tiket ditugaskan ke PIC: " + assigneeName
	if notes != nil && *notes != "" {
		msg += " - Catatan: " + *notes
	}

	eventPayload, _ := json.Marshal(map[string]interface{}{
		"assigned_to":   assignedTo,
		"assignee_name": assigneeName,
		"notes":         notes,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, propertyID, actorID, actorName, actorRole,
		"assigned", model.EventVisibilityPublic, msg, eventPayload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// TenantConfirmResolution confirms complaint resolution (AC 3).
func (r *ComplaintRepository) TenantConfirmResolution(ctx context.Context, id, userID uuid.UUID, comment *string) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var propertyID uuid.UUID
	var status string
	err = tx.QueryRow(ctx, `
		SELECT property_id, status FROM complaints WHERE id = $1 AND user_id = $2 FOR UPDATE`,
		id, userID,
	).Scan(&propertyID, &status)
	if err != nil {
		return err
	}

	if status != model.ComplaintStatusResolved {
		return errors.New("hanya komplain berstatus 'resolved' yang dapat dikonfirmasi selesai")
	}

	_, err = tx.Exec(ctx, `
		UPDATE complaints
		SET status = 'confirmed',
			confirmed_resolved_at = $1,
			updated_at = $1
		WHERE id = $2`, now, id,
	)
	if err != nil {
		return err
	}

	msg := "Penyewa mengonfirmasi bahwa komplain telah diselesaikan dengan baik."
	if comment != nil && *comment != "" {
		msg += " Ulasan: " + *comment
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"comment": comment,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, propertyID, userID, "Penyewa", "tenant",
		"confirmed", model.EventVisibilityPublic, msg, payload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// TenantReopen reopens a resolved or confirmed complaint (AC 3).
func (r *ComplaintRepository) TenantReopen(ctx context.Context, id, userID uuid.UUID, reason string) error {
	if reason == "" {
		return errors.New("alasan pembukaan kembali tiket wajib diisi")
	}

	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var propertyID uuid.UUID
	var status string
	err = tx.QueryRow(ctx, `
		SELECT property_id, status FROM complaints WHERE id = $1 AND user_id = $2 FOR UPDATE`,
		id, userID,
	).Scan(&propertyID, &status)
	if err != nil {
		return err
	}

	if status != model.ComplaintStatusResolved && status != model.ComplaintStatusConfirmed {
		return errors.New("tiket hanya dapat dibuka kembali jika sudah diselesaikan")
	}

	// Extend resolution target by 24h
	newResolutionDue := now.Add(24 * time.Hour)

	_, err = tx.Exec(ctx, `
		UPDATE complaints
		SET status = 'reopened',
			reopened_at = $1,
			resolution_due_at = $2,
			sla_status = 'warning',
			updated_at = $1
		WHERE id = $3`, now, newResolutionDue, id,
	)
	if err != nil {
		return err
	}

	msg := "Penyewa membuka kembali tiket komplain. Alasan: " + reason
	payload, _ := json.Marshal(map[string]interface{}{
		"reason": reason,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		id, propertyID, userID, "Penyewa", "tenant",
		"reopened", model.EventVisibilityPublic, msg, payload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// AddEvent adds a new event to the timeline and records first response if staff action.
func (r *ComplaintRepository) AddEvent(ctx context.Context, event *model.ComplaintEvent) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if event.Payload == nil {
		event.Payload = map[string]interface{}{}
	}
	payloadBytes, err := json.Marshal(event.Payload)
	if err != nil {
		payloadBytes = []byte("{}")
	}

	query := `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at`

	err = tx.QueryRow(ctx, query,
		event.ComplaintID, event.PropertyID, event.ActorID, event.ActorName, event.ActorRole,
		event.EventType, event.Visibility, event.Message, payloadBytes, now,
	).Scan(&event.ID, &event.CreatedAt)
	if err != nil {
		return err
	}

	// Update first_response_at if staff comment and not yet set
	if event.ActorRole != "tenant" {
		_, _ = tx.Exec(ctx, `
			UPDATE complaints
			SET first_response_at = COALESCE(first_response_at, $1), updated_at = $1
			WHERE id = $2 AND property_id = $3`, now, event.ComplaintID, event.PropertyID)
	}

	return tx.Commit(ctx)
}

// ListEvents lists timeline events. AC 2: If isTenant is true, filter visibility = 'public'.
func (r *ComplaintRepository) ListEvents(ctx context.Context, complaintID, propertyID uuid.UUID, isTenant bool) ([]model.ComplaintEvent, error) {
	var query string
	var args []interface{}

	if isTenant {
		query = `
			SELECT
				id, complaint_id, property_id, actor_id, actor_name, actor_role,
				event_type, visibility, message, payload, created_at
			FROM complaint_events
			WHERE complaint_id = $1 AND visibility = 'public'
			ORDER BY created_at ASC`
		args = []interface{}{complaintID}
	} else {
		query = `
			SELECT
				id, complaint_id, property_id, actor_id, actor_name, actor_role,
				event_type, visibility, message, payload, created_at
			FROM complaint_events
			WHERE complaint_id = $1 AND property_id = $2
			ORDER BY created_at ASC`
		args = []interface{}{complaintID, propertyID}
	}

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	events := make([]model.ComplaintEvent, 0)
	for rows.Next() {
		var e model.ComplaintEvent
		var payloadBytes []byte
		if err := rows.Scan(
			&e.ID, &e.ComplaintID, &e.PropertyID, &e.ActorID, &e.ActorName, &e.ActorRole,
			&e.EventType, &e.Visibility, &e.Message, &payloadBytes, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		if len(payloadBytes) > 0 {
			_ = json.Unmarshal(payloadBytes, &e.Payload)
		}
		if e.Payload == nil {
			e.Payload = make(map[string]interface{})
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// Vendor Repository Methods

func (r *ComplaintRepository) CreateVendor(ctx context.Context, v *model.Vendor) error {
	query := `
		INSERT INTO vendors (
			property_id, name, service_type, phone, email, address, notes, is_active, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		v.PropertyID, v.Name, v.ServiceType, v.Phone, v.Email, v.Address, v.Notes, v.IsActive,
	).Scan(&v.ID, &v.CreatedAt, &v.UpdatedAt)
}

func (r *ComplaintRepository) UpdateVendor(ctx context.Context, v *model.Vendor) error {
	query := `
		UPDATE vendors
		SET name = $1, service_type = $2, phone = $3, email = $4, address = $5,
		    notes = $6, is_active = $7, updated_at = NOW()
		WHERE id = $8 AND property_id = $9`
	tag, err := r.db.Exec(ctx, query,
		v.Name, v.ServiceType, v.Phone, v.Email, v.Address, v.Notes, v.IsActive, v.ID, v.PropertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *ComplaintRepository) ListVendors(ctx context.Context, propertyID uuid.UUID, activeOnly bool) ([]model.Vendor, error) {
	query := `
		SELECT id, property_id, name, service_type, phone, email, address, notes, is_active, created_at, updated_at
		FROM vendors
		WHERE property_id = $1 AND ($2 = false OR is_active = true)
		ORDER BY name ASC`

	rows, err := r.db.Query(ctx, query, propertyID, activeOnly)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	vendors := make([]model.Vendor, 0)
	for rows.Next() {
		var v model.Vendor
		if err := rows.Scan(
			&v.ID, &v.PropertyID, &v.Name, &v.ServiceType, &v.Phone, &v.Email,
			&v.Address, &v.Notes, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
		); err != nil {
			return nil, err
		}
		vendors = append(vendors, v)
	}
	return vendors, rows.Err()
}

func (r *ComplaintRepository) GetVendor(ctx context.Context, id, propertyID uuid.UUID) (*model.Vendor, error) {
	query := `
		SELECT id, property_id, name, service_type, phone, email, address, notes, is_active, created_at, updated_at
		FROM vendors
		WHERE id = $1 AND property_id = $2`

	var v model.Vendor
	err := r.db.QueryRow(ctx, query, id, propertyID).Scan(
		&v.ID, &v.PropertyID, &v.Name, &v.ServiceType, &v.Phone, &v.Email,
		&v.Address, &v.Notes, &v.IsActive, &v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

// Work Order Repository Methods

func (r *ComplaintRepository) CreateWorkOrder(ctx context.Context, wo *model.WorkOrder, actorName, actorRole string) error {
	now := time.Now()
	if wo.Status == "" {
		wo.Status = model.WorkOrderStatusDraft
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO work_orders (
			complaint_id, property_id, vendor_id, title, description,
			status, scheduled_date, estimated_cost, actual_cost, invoice_url,
			notes, created_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
		RETURNING id, created_at, updated_at`

	err = tx.QueryRow(ctx, query,
		wo.ComplaintID, wo.PropertyID, wo.VendorID, wo.Title, wo.Description,
		wo.Status, wo.ScheduledDate, wo.EstimatedCost, wo.ActualCost, wo.InvoiceURL,
		wo.Notes, wo.CreatedBy, now,
	).Scan(&wo.ID, &wo.CreatedAt, &wo.UpdatedAt)
	if err != nil {
		return err
	}

	// Update complaint status if scheduled
	if wo.ScheduledDate != nil {
		_, _ = tx.Exec(ctx, `
			UPDATE complaints
			SET status = CASE WHEN status IN ('pending', 'in_progress') THEN 'scheduled' ELSE status END,
			    updated_at = $1
			WHERE id = $2 AND property_id = $3`, now, wo.ComplaintID, wo.PropertyID)
	}

	// Create internal timeline event for staff
	internalMsg := "Work order dibuat: " + wo.Title
	woPayload, _ := json.Marshal(map[string]interface{}{
		"work_order_id":  wo.ID,
		"vendor_id":      wo.VendorID,
		"estimated_cost": wo.EstimatedCost,
		"scheduled_date": wo.ScheduledDate,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		wo.ComplaintID, wo.PropertyID, wo.CreatedBy, actorName, actorRole,
		"work_order_created", model.EventVisibilityInternal, internalMsg, woPayload, now,
	)
	if err != nil {
		return err
	}

	// Create public sanitized timeline event for tenant (AC 2: without sensitive cost details!)
	publicMsg := "Jadwal pengerjaan maintenance (" + wo.Title + ") sedang dikoordinasikan."
	if wo.ScheduledDate != nil {
		publicMsg = "Kunjungan teknisi dijadwalkan pada: " + wo.ScheduledDate.Format("02 Jan 2006 15:04")
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		wo.ComplaintID, wo.PropertyID, wo.CreatedBy, actorName, actorRole,
		"vendor_scheduled", model.EventVisibilityPublic, publicMsg, "{}", now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ComplaintRepository) UpdateWorkOrder(ctx context.Context, wo *model.WorkOrder, actorName, actorRole string) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var completedAt *time.Time
	if wo.Status == model.WorkOrderStatusCompleted {
		completedAt = &now
	}

	query := `
		UPDATE work_orders
		SET vendor_id = $1, title = $2, description = $3, status = $4,
		    scheduled_date = $5, estimated_cost = $6, actual_cost = $7,
		    invoice_url = $8, notes = $9,
		    completed_at = CASE WHEN $4 = 'completed' THEN COALESCE(completed_at, $10) ELSE completed_at END,
		    updated_at = $10
		WHERE id = $11 AND property_id = $12`

	tag, err := tx.Exec(ctx, query,
		wo.VendorID, wo.Title, wo.Description, wo.Status,
		wo.ScheduledDate, wo.EstimatedCost, wo.ActualCost,
		wo.InvoiceURL, wo.Notes, completedAt, wo.ID, wo.PropertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	internalMsg := "Work order '" + wo.Title + "' diperbarui ke status: " + wo.Status
	woPayload, _ := json.Marshal(map[string]interface{}{
		"work_order_id": wo.ID,
		"status":        wo.Status,
		"actual_cost":   wo.ActualCost,
	})

	_, err = tx.Exec(ctx, `
		INSERT INTO complaint_events (
			complaint_id, property_id, actor_id, actor_name, actor_role,
			event_type, visibility, message, payload, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		wo.ComplaintID, wo.PropertyID, wo.CreatedBy, actorName, actorRole,
		"cost_updated", model.EventVisibilityInternal, internalMsg, woPayload, now,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (r *ComplaintRepository) ListWorkOrders(ctx context.Context, complaintID, propertyID uuid.UUID) ([]model.WorkOrder, error) {
	query := `
		SELECT
			wo.id, wo.complaint_id, wo.property_id, wo.vendor_id,
			v.name AS vendor_name, v.phone AS vendor_phone,
			wo.title, wo.description, wo.status, wo.scheduled_date,
			wo.estimated_cost, wo.actual_cost, wo.invoice_url, wo.notes,
			wo.created_by, wo.completed_at, wo.created_at, wo.updated_at
		FROM work_orders wo
		LEFT JOIN vendors v ON v.id = wo.vendor_id
		WHERE wo.complaint_id = $1 AND wo.property_id = $2
		ORDER BY wo.created_at DESC`

	rows, err := r.db.Query(ctx, query, complaintID, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.WorkOrder, 0)
	for rows.Next() {
		var wo model.WorkOrder
		if err := rows.Scan(
			&wo.ID, &wo.ComplaintID, &wo.PropertyID, &wo.VendorID,
			&wo.VendorName, &wo.VendorPhone,
			&wo.Title, &wo.Description, &wo.Status, &wo.ScheduledDate,
			&wo.EstimatedCost, &wo.ActualCost, &wo.InvoiceURL, &wo.Notes,
			&wo.CreatedBy, &wo.CompletedAt, &wo.CreatedAt, &wo.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, wo)
	}
	return list, rows.Err()
}

func (r *ComplaintRepository) GetWorkOrder(ctx context.Context, id, propertyID uuid.UUID) (*model.WorkOrder, error) {
	query := `
		SELECT
			wo.id, wo.complaint_id, wo.property_id, wo.vendor_id,
			v.name AS vendor_name, v.phone AS vendor_phone,
			wo.title, wo.description, wo.status, wo.scheduled_date,
			wo.estimated_cost, wo.actual_cost, wo.invoice_url, wo.notes,
			wo.created_by, wo.completed_at, wo.created_at, wo.updated_at
		FROM work_orders wo
		LEFT JOIN vendors v ON v.id = wo.vendor_id
		WHERE wo.id = $1 AND wo.property_id = $2`

	var wo model.WorkOrder
	err := r.db.QueryRow(ctx, query, id, propertyID).Scan(
		&wo.ID, &wo.ComplaintID, &wo.PropertyID, &wo.VendorID,
		&wo.VendorName, &wo.VendorPhone,
		&wo.Title, &wo.Description, &wo.Status, &wo.ScheduledDate,
		&wo.EstimatedCost, &wo.ActualCost, &wo.InvoiceURL, &wo.Notes,
		&wo.CreatedBy, &wo.CompletedAt, &wo.CreatedAt, &wo.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &wo, nil
}

// AI Suggestions Repository Methods

func (r *ComplaintRepository) SaveAISuggestion(ctx context.Context, s *model.AISuggestion) error {
	query := `
		INSERT INTO ai_suggestions (
			complaint_id, property_id, suggested_category, suggested_priority,
			suggested_impact, summary, draft_response, recommended_action,
			confidence_score, model_version, is_applied, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
		RETURNING id, created_at`

	return r.db.QueryRow(ctx, query,
		s.ComplaintID, s.PropertyID, s.SuggestedCategory, s.SuggestedPriority,
		s.SuggestedImpact, s.Summary, s.DraftResponse, s.RecommendedAction,
		s.ConfidenceScore, s.ModelVersion, s.IsApplied,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *ComplaintRepository) GetAISuggestion(ctx context.Context, complaintID, propertyID uuid.UUID) (*model.AISuggestion, error) {
	query := `
		SELECT
			id, complaint_id, property_id, suggested_category, suggested_priority,
			suggested_impact, summary, draft_response, recommended_action,
			confidence_score, model_version, is_applied, applied_by, applied_at, created_at
		FROM ai_suggestions
		WHERE complaint_id = $1 AND property_id = $2
		ORDER BY created_at DESC
		LIMIT 1`

	var s model.AISuggestion
	err := r.db.QueryRow(ctx, query, complaintID, propertyID).Scan(
		&s.ID, &s.ComplaintID, &s.PropertyID, &s.SuggestedCategory, &s.SuggestedPriority,
		&s.SuggestedImpact, &s.Summary, &s.DraftResponse, &s.RecommendedAction,
		&s.ConfidenceScore, &s.ModelVersion, &s.IsApplied, &s.AppliedBy, &s.AppliedAt, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *ComplaintRepository) ApplyAISuggestion(ctx context.Context, complaintID, propertyID, appliedBy uuid.UUID, req model.ApplyAISuggestionRequest) error {
	now := time.Now()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var s model.AISuggestion
	err = tx.QueryRow(ctx, `
		SELECT suggested_category, suggested_priority, suggested_impact, draft_response
		FROM ai_suggestions
		WHERE complaint_id = $1 AND property_id = $2
		ORDER BY created_at DESC
		LIMIT 1`, complaintID, propertyID,
	).Scan(&s.SuggestedCategory, &s.SuggestedPriority, &s.SuggestedImpact, &s.DraftResponse)
	if err != nil {
		return err
	}

	// Update complaint fields based on human selection
	if req.ApplyPriority || req.ApplyCategory || req.ApplyDraftResponse {
		_, err = tx.Exec(ctx, `
			UPDATE complaints
			SET priority = CASE WHEN $1 = true THEN $2 ELSE priority END,
			    category = CASE WHEN $3 = true THEN $4 ELSE category END,
			    ai_response = CASE WHEN $5 = true THEN $6 ELSE ai_response END,
			    updated_at = $7
			WHERE id = $8 AND property_id = $9`,
			req.ApplyPriority, s.SuggestedPriority,
			req.ApplyCategory, s.SuggestedCategory,
			req.ApplyDraftResponse, s.DraftResponse,
			now, complaintID, propertyID,
		)
		if err != nil {
			return err
		}
	}

	// Mark AI suggestion applied
	_, err = tx.Exec(ctx, `
		UPDATE ai_suggestions
		SET is_applied = true, applied_by = $1, applied_at = $2
		WHERE complaint_id = $3 AND property_id = $4`,
		appliedBy, now, complaintID, propertyID,
	)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// SLA Dashboard Statistics (AC 4)

func (r *ComplaintRepository) GetSLADashboardStats(ctx context.Context, propertyID uuid.UUID) (*model.SLADashboardStats, error) {
	stats := &model.SLADashboardStats{
		PriorityBreakdown: make(map[string]int),
		StatusBreakdown:   make(map[string]int),
	}

	complaints, err := r.FindByProperty(ctx, propertyID)
	if err != nil {
		return nil, err
	}

	stats.TotalComplaints = len(complaints)
	var totalFirstResponseMinutes float64
	var countFirstResponse int
	var totalResolutionMinutes float64
	var countResolved int
	var countWithinSLA int

	now := time.Now()

	for _, c := range complaints {
		// Priority breakdown
		stats.PriorityBreakdown[c.Priority]++
		// Status breakdown
		stats.StatusBreakdown[c.Status]++

		isOpen := c.Status != model.ComplaintStatusResolved && c.Status != model.ComplaintStatusConfirmed && c.Status != model.ComplaintStatusCancelled
		if isOpen {
			stats.OpenComplaints++
			if c.Priority == model.ComplaintPriorityUrgent && c.Status == model.ComplaintStatusPending {
				stats.HighPriorityPendingAlert++
			}
		}

		// First response time
		if c.FirstResponseAt != nil {
			dur := c.FirstResponseAt.Sub(c.CreatedAt).Minutes()
			if dur >= 0 {
				totalFirstResponseMinutes += dur
				countFirstResponse++
			}
		}

		// Resolution time
		if c.ResolvedAt != nil {
			dur := c.ResolvedAt.Sub(c.CreatedAt).Minutes()
			if dur >= 0 {
				totalResolutionMinutes += dur
				countResolved++
			}
		}

		// Re-evaluate SLA status
		slaStatus := model.EvaluateSLAStatus(now, c.Status, c.FirstResponseAt, c.ResolvedAt, c.FirstResponseDueAt, c.ResolutionDueAt)
		if slaStatus == model.SLAStatusBreached {
			stats.BreachedCount++
		} else if slaStatus == model.SLAStatusWarning {
			stats.WarningCount++
		}

		if (c.Status == model.ComplaintStatusResolved || c.Status == model.ComplaintStatusConfirmed) && slaStatus != model.SLAStatusBreached {
			countWithinSLA++
		}
	}

	if countFirstResponse > 0 {
		stats.AvgFirstResponseMinutes = totalFirstResponseMinutes / float64(countFirstResponse)
	}
	if countResolved > 0 {
		stats.AvgResolutionMinutes = totalResolutionMinutes / float64(countResolved)
		stats.ComplianceRate = (float64(countWithinSLA) / float64(countResolved)) * 100
	} else if stats.TotalComplaints > 0 {
		stats.ComplianceRate = 100.0 - (float64(stats.BreachedCount) / float64(stats.TotalComplaints) * 100.0)
		if stats.ComplianceRate < 0 {
			stats.ComplianceRate = 0
		}
	} else {
		stats.ComplianceRate = 100.0
	}

	return stats, nil
}

func (r *ComplaintRepository) FindPropertyWhatsAppGroupLink(ctx context.Context, propertyID uuid.UUID) (string, error) {
	var link string
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(whatsapp_group_link, '')
		FROM properties WHERE id = $1 AND status <> 'archived'`, propertyID,
	).Scan(&link)
	return link, err
}

func (r *ComplaintRepository) UpdatePropertyWhatsAppGroupLink(ctx context.Context, propertyID uuid.UUID, link string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE properties SET whatsapp_group_link = $1, updated_at = NOW()
		WHERE id = $2 AND status <> 'archived'`, link, propertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return pgx.ErrNoRows
	}
	return nil
}
