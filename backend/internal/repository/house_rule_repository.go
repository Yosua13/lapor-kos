package repository

import (
	"context"
	"fmt"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HouseRuleRepository struct {
	db *pgxpool.Pool
}

func NewHouseRuleRepository(db *pgxpool.Pool) *HouseRuleRepository {
	return &HouseRuleRepository{db: db}
}

func (r *HouseRuleRepository) Create(ctx context.Context, rule *model.HouseRule) error {
	query := `
		INSERT INTO house_rules (
			owner_id, category, title, description, details
		) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		rule.OwnerID, rule.Category, rule.Title, rule.Description, rule.Details,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
}

func (r *HouseRuleRepository) BulkCreate(ctx context.Context, rules []model.HouseRule) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	query := `
		INSERT INTO house_rules (
			owner_id, category, title, description, details
		) VALUES ($1, $2, $3, $4, $5)
	`
	for _, rule := range rules {
		_, err := tx.Exec(ctx, query,
			rule.OwnerID, rule.Category, rule.Title, rule.Description, rule.Details,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *HouseRuleRepository) FindAllByOwner(ctx context.Context, ownerID uuid.UUID) ([]model.HouseRule, error) {
	query := `
		SELECT id, owner_id, category, title, description, details, created_at, updated_at
		FROM house_rules
		WHERE owner_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Query(ctx, query, ownerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.HouseRule
	for rows.Next() {
		var rule model.HouseRule
		err := rows.Scan(
			&rule.ID, &rule.OwnerID, &rule.Category, &rule.Title, &rule.Description, &rule.Details,
			&rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}

	return rules, nil
}

func (r *HouseRuleRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.HouseRule, error) {
	query := `
		SELECT id, owner_id, category, title, description, details, created_at, updated_at
		FROM house_rules
		WHERE id = $1
	`
	rule := &model.HouseRule{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&rule.ID, &rule.OwnerID, &rule.Category, &rule.Title, &rule.Description, &rule.Details,
		&rule.CreatedAt, &rule.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return rule, nil
}

func (r *HouseRuleRepository) Update(ctx context.Context, rule *model.HouseRule) error {
	query := `
		UPDATE house_rules
		SET category = $1, title = $2, description = $3, details = $4, updated_at = NOW()
		WHERE id = $5 AND owner_id = $6
	`
	tag, err := r.db.Exec(ctx, query,
		rule.Category, rule.Title, rule.Description, rule.Details, rule.ID, rule.OwnerID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("rule not found or unauthorized")
	}
	return nil
}

func (r *HouseRuleRepository) Delete(ctx context.Context, id uuid.UUID, ownerID uuid.UUID) error {
	query := `
		DELETE FROM house_rules
		WHERE id = $1 AND owner_id = $2
	`
	tag, err := r.db.Exec(ctx, query, id, ownerID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("rule not found or unauthorized")
	}
	return nil
}

func (r *HouseRuleRepository) FindActiveContractOwnerIDByTenant(ctx context.Context, tenantUserID uuid.UUID) (uuid.UUID, error) {
	query := `
		SELECT owner_id
		FROM contracts
		WHERE user_id = $1 AND status = 'active'
		LIMIT 1
	`
	var ownerID uuid.UUID
	err := r.db.QueryRow(ctx, query, tenantUserID).Scan(&ownerID)
	if err != nil {
		return uuid.Nil, err
	}
	return ownerID, nil
}
