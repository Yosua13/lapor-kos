package repository

import (
	"context"

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

// FindActiveContractByTenantUser derives the support tenancy boundary from an
// authenticated tenant's active contract. Tenant routes must never trust a
// caller-supplied property id.
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

// Create revalidates the active contract in the INSERT itself. This closes the
// gap between resolving a tenant context and persisting the complaint.
func (r *ComplaintRepository) Create(ctx context.Context, complaint *model.Complaint) error {
	query := `
		INSERT INTO complaints (
			property_id, user_id, owner_id, room_id, title, description,
			category, status, photo_url, ai_response, wa_sent, wa_message
		)
		SELECT
			c.property_id, c.user_id, c.owner_id, c.room_id,
			$5, $6, $7, $8, $9, $10, $11, $12
		FROM contracts c
		WHERE c.user_id = $1
		  AND c.property_id = $2
		  AND c.room_id = $3
		  AND c.owner_id = $4
		  AND c.status = 'active'
		ORDER BY c.created_at DESC
		LIMIT 1
		RETURNING id, property_id, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		complaint.UserID, complaint.PropertyID, complaint.RoomID, complaint.OwnerID,
		complaint.Title, complaint.Description, complaint.Category, complaint.Status,
		complaint.PhotoURL, complaint.AIResponse, complaint.WASent, complaint.WAMessage,
	).Scan(&complaint.ID, &complaint.PropertyID, &complaint.CreatedAt, &complaint.UpdatedAt)
}

func (r *ComplaintRepository) FindByTenant(ctx context.Context, userID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.status, c.photo_url,
			c.ai_response, c.wa_sent, c.wa_message, c.created_at, c.updated_at,
			rm.room_number, u.name
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		WHERE c.user_id = $1
		ORDER BY c.created_at DESC`
	return r.findMany(ctx, query, userID)
}

func (r *ComplaintRepository) FindByProperty(ctx context.Context, propertyID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT
			c.id, c.property_id, c.user_id, c.owner_id, c.room_id,
			c.title, c.description, c.category, c.status, c.photo_url,
			c.ai_response, c.wa_sent, c.wa_message, c.created_at, c.updated_at,
			rm.room_number, u.name
		FROM complaints c
		JOIN users u ON u.id = c.user_id
		JOIN rooms rm ON rm.id = c.room_id AND rm.property_id = c.property_id
		WHERE c.property_id = $1
		ORDER BY c.created_at DESC`
	return r.findMany(ctx, query, propertyID)
}

func (r *ComplaintRepository) findMany(ctx context.Context, query string, arg uuid.UUID) ([]model.Complaint, error) {
	rows, err := r.db.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	complaints := make([]model.Complaint, 0)
	for rows.Next() {
		var complaint model.Complaint
		if err := rows.Scan(
			&complaint.ID, &complaint.PropertyID, &complaint.UserID,
			&complaint.OwnerID, &complaint.RoomID, &complaint.Title,
			&complaint.Description, &complaint.Category, &complaint.Status,
			&complaint.PhotoURL, &complaint.AIResponse, &complaint.WASent,
			&complaint.WAMessage, &complaint.CreatedAt, &complaint.UpdatedAt,
			&complaint.RoomNumber, &complaint.UserName,
		); err != nil {
			return nil, err
		}
		complaints = append(complaints, complaint)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return complaints, nil
}

func (r *ComplaintRepository) UpdateStatus(ctx context.Context, id, propertyID uuid.UUID, status string) error {
	query := `
		UPDATE complaints
		SET status = $1, updated_at = NOW()
		WHERE id = $2 AND property_id = $3`
	tag, err := r.db.Exec(ctx, query, status, id, propertyID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
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
