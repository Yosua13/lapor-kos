package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ComplaintRepository struct {
	db *pgxpool.Pool
}

func NewComplaintRepository(db *pgxpool.Pool) *ComplaintRepository {
	return &ComplaintRepository{db: db}
}

func (r *ComplaintRepository) FindActiveContractByTenantUser(ctx context.Context, userID uuid.UUID) (roomID uuid.UUID, ownerID uuid.UUID, err error) {
	query := `
		SELECT c.room_id, c.owner_id
		FROM contracts c
		WHERE c.user_id = $1 AND c.status = 'active'
		LIMIT 1
	`
	err = r.db.QueryRow(ctx, query, userID).Scan(&roomID, &ownerID)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("active contract not found: %w", err)
	}
	return roomID, ownerID, nil
}

func (r *ComplaintRepository) Create(ctx context.Context, c *model.Complaint) error {
	query := `
		INSERT INTO complaints (
			user_id, owner_id, room_id, title, description, category, status, photo_url, ai_response, wa_sent, wa_message
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		c.UserID, c.OwnerID, c.RoomID, c.Title, c.Description, c.Category, c.Status,
		c.PhotoURL, c.AIResponse, c.WASent, c.WAMessage,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *ComplaintRepository) FindByTenant(ctx context.Context, userID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT 
			c.id, c.user_id, c.owner_id, c.room_id, c.title, c.description, c.category, c.status, 
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message, c.created_at, c.updated_at,
			rm.room_number, u.name
		FROM complaints c
		JOIN users u ON c.user_id = u.id
		JOIN rooms rm ON c.room_id = rm.id
		WHERE c.user_id = $1
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []model.Complaint
	for rows.Next() {
		var comp model.Complaint
		err := rows.Scan(
			&comp.ID, &comp.UserID, &comp.OwnerID, &comp.RoomID, &comp.Title, &comp.Description, &comp.Category, &comp.Status,
			&comp.PhotoURL, &comp.AIResponse, &comp.WASent, &comp.WAMessage, &comp.CreatedAt, &comp.UpdatedAt,
			&comp.RoomNumber, &comp.UserName,
		)
		if err != nil {
			return nil, err
		}
		complaints = append(complaints, comp)
	}

	return complaints, nil
}

func (r *ComplaintRepository) FindByOwner(ctx context.Context, ownerID uuid.UUID) ([]model.Complaint, error) {
	query := `
		SELECT 
			c.id, c.user_id, c.owner_id, c.room_id, c.title, c.description, c.category, c.status, 
			c.photo_url, c.ai_response, c.wa_sent, c.wa_message, c.created_at, c.updated_at,
			rm.room_number, u.name
		FROM complaints c
		JOIN users u ON c.user_id = u.id
		JOIN rooms rm ON c.room_id = rm.id
		WHERE c.owner_id = $1
		ORDER BY c.created_at DESC
	`
	rows, err := r.db.Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []model.Complaint
	for rows.Next() {
		var comp model.Complaint
		err := rows.Scan(
			&comp.ID, &comp.UserID, &comp.OwnerID, &comp.RoomID, &comp.Title, &comp.Description, &comp.Category, &comp.Status,
			&comp.PhotoURL, &comp.AIResponse, &comp.WASent, &comp.WAMessage, &comp.CreatedAt, &comp.UpdatedAt,
			&comp.RoomNumber, &comp.UserName,
		)
		if err != nil {
			return nil, err
		}
		complaints = append(complaints, comp)
	}

	return complaints, nil
}

func (r *ComplaintRepository) UpdateStatus(ctx context.Context, id uuid.UUID, ownerID uuid.UUID, status string) error {
	query := `
		UPDATE complaints 
		SET status = $1, updated_at = NOW() 
		WHERE id = $2 AND owner_id = $3
	`
	tag, err := r.db.Exec(ctx, query, status, id, ownerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("complaint not found or unauthorized")
	}
	return nil
}
