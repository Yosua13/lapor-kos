package repository

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
			property_id, owner_id, category, title, description, details
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.db.QueryRow(ctx, query,
		rule.PropertyID, rule.OwnerID, rule.Category, rule.Title,
		rule.Description, rule.Details,
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
			property_id, owner_id, category, title, description, details
		) VALUES ($1, $2, $3, $4, $5, $6)`
	for _, rule := range rules {
		if _, err := tx.Exec(ctx, query,
			rule.PropertyID, rule.OwnerID, rule.Category, rule.Title,
			rule.Description, rule.Details,
		); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

func (r *HouseRuleRepository) FindAllByProperty(ctx context.Context, propertyID uuid.UUID) ([]model.HouseRule, error) {
	query := `
		SELECT id, property_id, owner_id, category, title, description,
			details, created_at, updated_at
		FROM house_rules
		WHERE property_id = $1
		ORDER BY created_at ASC`
	rows, err := r.db.Query(ctx, query, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	rules := make([]model.HouseRule, 0)
	for rows.Next() {
		var rule model.HouseRule
		if err := rows.Scan(
			&rule.ID, &rule.PropertyID, &rule.OwnerID, &rule.Category,
			&rule.Title, &rule.Description, &rule.Details,
			&rule.CreatedAt, &rule.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rules = append(rules, rule)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return rules, nil
}

func (r *HouseRuleRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*model.HouseRule, error) {
	query := `
		SELECT id, property_id, owner_id, category, title, description,
			details, created_at, updated_at
		FROM house_rules
		WHERE id = $1 AND property_id = $2`
	rule := &model.HouseRule{}
	err := r.db.QueryRow(ctx, query, id, propertyID).Scan(
		&rule.ID, &rule.PropertyID, &rule.OwnerID, &rule.Category,
		&rule.Title, &rule.Description, &rule.Details,
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
		SET category = $1, title = $2, description = $3,
			details = $4, updated_at = NOW()
		WHERE id = $5 AND property_id = $6`
	tag, err := r.db.Exec(ctx, query,
		rule.Category, rule.Title, rule.Description, rule.Details,
		rule.ID, rule.PropertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *HouseRuleRepository) Delete(ctx context.Context, id, propertyID uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM house_rules WHERE id = $1 AND property_id = $2`,
		id, propertyID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}

func (r *HouseRuleRepository) FindActiveContractContextByTenant(ctx context.Context, tenantUserID uuid.UUID) (propertyID, ownerID uuid.UUID, err error) {
	query := `
		SELECT property_id, owner_id
		FROM contracts
		WHERE user_id = $1 AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1`
	err = r.db.QueryRow(ctx, query, tenantUserID).Scan(&propertyID, &ownerID)
	return
}
