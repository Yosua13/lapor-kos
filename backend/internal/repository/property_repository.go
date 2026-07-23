package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrPropertyNotFound       = errors.New("property not found")
	ErrPropertyAccessNotFound = errors.New("property access not found")
	ErrPropertyMemberNotFound = errors.New("property member not found")
	ErrPropertyUserNotFound   = errors.New("user is not available for membership")
	ErrPropertyMemberExists   = errors.New("user is already a property member")
	ErrLastPropertyOwner      = errors.New("property must keep at least one active owner")
)

type PropertyRepository struct {
	db *pgxpool.Pool
}

func NewPropertyRepository(db *pgxpool.Pool) *PropertyRepository {
	return &PropertyRepository{db: db}
}

func (r *PropertyRepository) CreateWithOwner(ctx context.Context, actorID uuid.UUID, property *model.Property) (*model.PropertyAccess, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin create property: %w", err)
	}
	defer tx.Rollback(ctx)

	property.CreatedBy = actorID
	if property.Timezone == "" {
		property.Timezone = model.DefaultPropertyTimezone
	}
	if property.Currency == "" {
		property.Currency = model.DefaultPropertyCurrency
	}
	if property.Status == "" {
		property.Status = model.PropertyStatusDraft
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO properties (name, address, timezone, currency, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at
	`, property.Name, property.Address, property.Timezone, property.Currency, string(property.Status), actorID).
		Scan(&property.ID, &property.CreatedAt, &property.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert property: %w", err)
	}

	permissionsJSON, err := marshalPermissions(nil)
	if err != nil {
		return nil, err
	}

	var membershipID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO property_memberships (property_id, user_id, role, permissions, status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, property.ID, actorID, string(model.PropertyRoleOwner), string(permissionsJSON), string(model.MembershipStatusActive), actorID).
		Scan(&membershipID)
	if err != nil {
		return nil, fmt.Errorf("insert property owner membership: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create property: %w", err)
	}

	return &model.PropertyAccess{
		ID:           property.ID,
		Name:         property.Name,
		Address:      property.Address,
		Timezone:     property.Timezone,
		Currency:     property.Currency,
		Status:       property.Status,
		MembershipID: membershipID,
		Role:         model.PropertyRoleOwner,
		Permissions:  []string{},
	}, nil
}

func (r *PropertyRepository) ListForUser(ctx context.Context, userID uuid.UUID) ([]model.PropertyAccess, error) {
	rows, err := r.db.Query(ctx, `
		SELECT p.id, p.name, p.address, p.timezone, p.currency, p.status,
		       pm.id, pm.role, pm.permissions
		FROM property_memberships pm
		JOIN properties p ON p.id = pm.property_id
		WHERE pm.user_id = $1
		  AND pm.status = 'active'
		  AND p.status <> 'archived'
		ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
		         lower(p.name), p.id
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list user properties: %w", err)
	}
	defer rows.Close()

	properties := make([]model.PropertyAccess, 0)
	for rows.Next() {
		var access model.PropertyAccess
		var role, status string
		var permissionsJSON []byte
		if err := rows.Scan(
			&access.ID,
			&access.Name,
			&access.Address,
			&access.Timezone,
			&access.Currency,
			&status,
			&access.MembershipID,
			&role,
			&permissionsJSON,
		); err != nil {
			return nil, fmt.Errorf("scan user property: %w", err)
		}
		access.Status = model.PropertyStatus(status)
		access.Role = model.PropertyRole(role)
		access.Permissions, err = unmarshalPermissions(permissionsJSON)
		if err != nil {
			return nil, fmt.Errorf("decode property permissions: %w", err)
		}
		properties = append(properties, access)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user properties: %w", err)
	}
	return properties, nil
}

func (r *PropertyRepository) FindByID(ctx context.Context, propertyID uuid.UUID) (*model.Property, error) {
	property := &model.Property{}
	var status string
	err := r.db.QueryRow(ctx, `
		SELECT id, name, address, timezone, currency, status, whatsapp_group_link,
		       created_by, created_at, updated_at
		FROM properties
		WHERE id = $1
	`, propertyID).Scan(
		&property.ID,
		&property.Name,
		&property.Address,
		&property.Timezone,
		&property.Currency,
		&status,
		&property.WhatsAppGroupLink,
		&property.CreatedBy,
		&property.CreatedAt,
		&property.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find property: %w", err)
	}
	property.Status = model.PropertyStatus(status)
	return property, nil
}

func (r *PropertyRepository) Update(ctx context.Context, propertyID uuid.UUID, input model.UpdatePropertyRequest) (*model.Property, error) {
	var status any
	if input.Status != nil {
		status = string(*input.Status)
	}

	property := &model.Property{}
	var persistedStatus string
	err := r.db.QueryRow(ctx, `
		UPDATE properties
		SET name = COALESCE($2, name),
		    address = COALESCE($3, address),
		    timezone = COALESCE($4, timezone),
		    currency = COALESCE($5, currency),
		    status = COALESCE($6, status),
		    whatsapp_group_link = COALESCE($7, whatsapp_group_link),
		    updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, address, timezone, currency, status, whatsapp_group_link,
		          created_by, created_at, updated_at
	`, propertyID, input.Name, input.Address, input.Timezone, input.Currency, status, input.WhatsAppGroupLink).Scan(
		&property.ID,
		&property.Name,
		&property.Address,
		&property.Timezone,
		&property.Currency,
		&persistedStatus,
		&property.WhatsAppGroupLink,
		&property.CreatedBy,
		&property.CreatedAt,
		&property.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("update property: %w", err)
	}
	property.Status = model.PropertyStatus(persistedStatus)
	return property, nil
}

// FindActiveMembership is intentionally the single lookup used by property
// middleware. Archived properties and non-active memberships are indistinguishable
// from unknown properties to prevent existence disclosure.
func (r *PropertyRepository) FindActiveMembership(ctx context.Context, propertyID, userID uuid.UUID) (*model.PropertyMembership, error) {
	membership := &model.PropertyMembership{}
	var role, status string
	var permissionsJSON []byte
	err := r.db.QueryRow(ctx, `
		SELECT pm.id, pm.property_id, pm.user_id, pm.role, pm.permissions, pm.status,
		       pm.created_by, pm.created_at, pm.updated_at, pm.revoked_at
		FROM property_memberships pm
		JOIN properties p ON p.id = pm.property_id
		JOIN users u ON u.id = pm.user_id
		WHERE pm.property_id = $1
		  AND pm.user_id = $2
		  AND pm.status = 'active'
		  AND p.status <> 'archived'
		  AND u.is_active = TRUE
	`, propertyID, userID).Scan(
		&membership.ID,
		&membership.PropertyID,
		&membership.UserID,
		&role,
		&permissionsJSON,
		&status,
		&membership.CreatedBy,
		&membership.CreatedAt,
		&membership.UpdatedAt,
		&membership.RevokedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyAccessNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find active property membership: %w", err)
	}
	membership.Role = model.PropertyRole(role)
	membership.Status = model.MembershipStatus(status)
	membership.Permissions, err = unmarshalPermissions(permissionsJSON)
	if err != nil {
		return nil, fmt.Errorf("decode membership permissions: %w", err)
	}
	return membership, nil
}

func (r *PropertyRepository) ListMembers(ctx context.Context, propertyID uuid.UUID) ([]model.PropertyMember, error) {
	rows, err := r.db.Query(ctx, `
		SELECT pm.id, pm.property_id, pm.user_id, pm.role, pm.permissions, pm.status,
		       pm.created_by, pm.created_at, pm.updated_at, pm.revoked_at,
		       u.name, u.email
		FROM property_memberships pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.property_id = $1
		ORDER BY CASE pm.status WHEN 'active' THEN 0 WHEN 'suspended' THEN 1 ELSE 2 END,
		         CASE pm.role WHEN 'property_owner' THEN 0 ELSE 1 END,
		         lower(u.name), pm.id
	`, propertyID)
	if err != nil {
		return nil, fmt.Errorf("list property members: %w", err)
	}
	defer rows.Close()

	members := make([]model.PropertyMember, 0)
	for rows.Next() {
		member, err := scanPropertyMember(rows)
		if err != nil {
			return nil, fmt.Errorf("scan property member: %w", err)
		}
		members = append(members, *member)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate property members: %w", err)
	}
	return members, nil
}

func (r *PropertyRepository) AddMemberByEmail(ctx context.Context, propertyID, actorID uuid.UUID, email string, role model.PropertyRole, permissions []string) (*model.PropertyMember, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin add property member: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := lockMutableProperty(ctx, tx, propertyID); err != nil {
		return nil, err
	}

	var userID uuid.UUID
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM users
		WHERE lower(email) = lower($1)
	`, strings.TrimSpace(email)).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find membership user: %w", err)
	}

	var existingID uuid.UUID
	var existingStatus string
	existingErr := tx.QueryRow(ctx, `
		SELECT id, status
		FROM property_memberships
		WHERE property_id = $1 AND user_id = $2
		FOR UPDATE
	`, propertyID, userID).Scan(&existingID, &existingStatus)
	if existingErr != nil && !errors.Is(existingErr, pgx.ErrNoRows) {
		return nil, fmt.Errorf("find existing property member: %w", existingErr)
	}

	permissionsJSON, err := marshalPermissions(permissions)
	if err != nil {
		return nil, err
	}

	var membershipID uuid.UUID
	switch {
	case errors.Is(existingErr, pgx.ErrNoRows):
		err = tx.QueryRow(ctx, `
			INSERT INTO property_memberships (property_id, user_id, role, permissions, status, created_by)
			VALUES ($1, $2, $3, $4, 'active', $5)
			RETURNING id
		`, propertyID, userID, string(role), string(permissionsJSON), actorID).Scan(&membershipID)
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return nil, ErrPropertyMemberExists
			}
			return nil, fmt.Errorf("insert property member: %w", err)
		}
	case model.MembershipStatus(existingStatus) == model.MembershipStatusRevoked:
		membershipID = existingID
		tag, updateErr := tx.Exec(ctx, `
			UPDATE property_memberships
			SET role = $3, permissions = $4, status = 'active',
			    created_by = $5, revoked_at = NULL, updated_at = NOW()
			WHERE id = $1 AND property_id = $2
		`, membershipID, propertyID, string(role), string(permissionsJSON), actorID)
		if updateErr != nil {
			return nil, fmt.Errorf("reactivate property member: %w", updateErr)
		}
		if tag.RowsAffected() != 1 {
			return nil, ErrPropertyMemberNotFound
		}
	default:
		return nil, ErrPropertyMemberExists
	}

	member, err := findMemberByID(ctx, tx, propertyID, membershipID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit add property member: %w", err)
	}
	return member, nil
}

func (r *PropertyRepository) UpdateMember(ctx context.Context, propertyID, membershipID uuid.UUID, input model.UpdatePropertyMemberRequest) (*model.PropertyMember, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin update property member: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := lockMutableProperty(ctx, tx, propertyID); err != nil {
		return nil, err
	}

	var currentRole, currentStatus string
	var currentPermissionsJSON []byte
	err = tx.QueryRow(ctx, `
		SELECT role, status, permissions
		FROM property_memberships
		WHERE id = $1 AND property_id = $2
		FOR UPDATE
	`, membershipID, propertyID).Scan(&currentRole, &currentStatus, &currentPermissionsJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyMemberNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock property member: %w", err)
	}

	role := model.PropertyRole(currentRole)
	status := model.MembershipStatus(currentStatus)
	permissions, err := unmarshalPermissions(currentPermissionsJSON)
	if err != nil {
		return nil, fmt.Errorf("decode current member permissions: %w", err)
	}
	if input.Role != nil {
		role = *input.Role
	}
	if input.Status != nil {
		status = *input.Status
	}
	if input.Permissions != nil {
		permissions = *input.Permissions
	}

	if model.PropertyRole(currentRole) == model.PropertyRoleOwner &&
		model.MembershipStatus(currentStatus) == model.MembershipStatusActive &&
		(role != model.PropertyRoleOwner || status != model.MembershipStatusActive) {
		if err := ensureAnotherActiveOwner(ctx, tx, propertyID, membershipID); err != nil {
			return nil, err
		}
	}

	permissionsJSON, err := marshalPermissions(permissions)
	if err != nil {
		return nil, err
	}
	tag, err := tx.Exec(ctx, `
		UPDATE property_memberships
		SET role = $3,
		    status = $4,
		    permissions = $5,
		    revoked_at = CASE WHEN $4 = 'revoked' THEN COALESCE(revoked_at, NOW()) ELSE NULL END,
		    updated_at = NOW()
		WHERE id = $1 AND property_id = $2
	`, membershipID, propertyID, string(role), string(status), string(permissionsJSON))
	if err != nil {
		return nil, fmt.Errorf("update property member: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return nil, ErrPropertyMemberNotFound
	}

	member, err := findMemberByID(ctx, tx, propertyID, membershipID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit update property member: %w", err)
	}
	return member, nil
}

func (r *PropertyRepository) RevokeMember(ctx context.Context, propertyID, membershipID uuid.UUID) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin revoke property member: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := lockMutableProperty(ctx, tx, propertyID); err != nil {
		return err
	}

	var role, status string
	err = tx.QueryRow(ctx, `
		SELECT role, status
		FROM property_memberships
		WHERE id = $1 AND property_id = $2
		FOR UPDATE
	`, membershipID, propertyID).Scan(&role, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPropertyMemberNotFound
	}
	if err != nil {
		return fmt.Errorf("lock property member for revoke: %w", err)
	}
	if model.MembershipStatus(status) == model.MembershipStatusRevoked {
		return ErrPropertyMemberNotFound
	}
	if model.PropertyRole(role) == model.PropertyRoleOwner && model.MembershipStatus(status) == model.MembershipStatusActive {
		if err := ensureAnotherActiveOwner(ctx, tx, propertyID, membershipID); err != nil {
			return err
		}
	}

	tag, err := tx.Exec(ctx, `
		UPDATE property_memberships
		SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW()
		WHERE id = $1 AND property_id = $2 AND status <> 'revoked'
	`, membershipID, propertyID)
	if err != nil {
		return fmt.Errorf("revoke property member: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return ErrPropertyMemberNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit revoke property member: %w", err)
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

type propertyTx interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func scanPropertyMember(row rowScanner) (*model.PropertyMember, error) {
	member := &model.PropertyMember{}
	var role, status string
	var permissionsJSON []byte
	err := row.Scan(
		&member.ID,
		&member.PropertyID,
		&member.UserID,
		&role,
		&permissionsJSON,
		&status,
		&member.CreatedBy,
		&member.CreatedAt,
		&member.UpdatedAt,
		&member.RevokedAt,
		&member.Name,
		&member.Email,
	)
	if err != nil {
		return nil, err
	}
	member.Role = model.PropertyRole(role)
	member.Status = model.MembershipStatus(status)
	member.Permissions, err = unmarshalPermissions(permissionsJSON)
	if err != nil {
		return nil, err
	}
	return member, nil
}

func findMemberByID(ctx context.Context, tx propertyTx, propertyID, membershipID uuid.UUID) (*model.PropertyMember, error) {
	member, err := scanPropertyMember(tx.QueryRow(ctx, `
		SELECT pm.id, pm.property_id, pm.user_id, pm.role, pm.permissions, pm.status,
		       pm.created_by, pm.created_at, pm.updated_at, pm.revoked_at,
		       u.name, u.email
		FROM property_memberships pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.id = $1 AND pm.property_id = $2
	`, membershipID, propertyID))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPropertyMemberNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("find property member: %w", err)
	}
	return member, nil
}

func lockMutableProperty(ctx context.Context, tx propertyTx, propertyID uuid.UUID) error {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		SELECT id
		FROM properties
		WHERE id = $1 AND status <> 'archived'
		FOR UPDATE
	`, propertyID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrPropertyNotFound
	}
	if err != nil {
		return fmt.Errorf("lock property: %w", err)
	}
	return nil
}

func ensureAnotherActiveOwner(ctx context.Context, tx propertyTx, propertyID, excludedMembershipID uuid.UUID) error {
	var owners int
	err := tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM property_memberships
		WHERE property_id = $1
		  AND id <> $2
		  AND role = 'property_owner'
		  AND status = 'active'
	`, propertyID, excludedMembershipID).Scan(&owners)
	if err != nil {
		return fmt.Errorf("count active property owners: %w", err)
	}
	if owners == 0 {
		return ErrLastPropertyOwner
	}
	return nil
}

func marshalPermissions(permissions []string) ([]byte, error) {
	if permissions == nil {
		permissions = []string{}
	}
	encoded, err := json.Marshal(permissions)
	if err != nil {
		return nil, fmt.Errorf("encode property permissions: %w", err)
	}
	return encoded, nil
}

func unmarshalPermissions(encoded []byte) ([]string, error) {
	if len(encoded) == 0 || string(encoded) == "null" {
		return []string{}, nil
	}
	var permissions []string
	if err := json.Unmarshal(encoded, &permissions); err != nil {
		return nil, err
	}
	if permissions == nil {
		permissions = []string{}
	}
	return permissions, nil
}
