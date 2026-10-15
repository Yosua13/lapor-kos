package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrRuleNotFound        = errors.New("rule not found")
	ErrRuleVersionNotFound = errors.New("rule version not found")
	ErrDraftAlreadyExists  = errors.New("a draft rule version already exists")
	ErrNoDraftFound        = errors.New("no draft rule version found")
	ErrEmptyRules          = errors.New("cannot publish empty rules")
	ErrImmutableVersion    = errors.New("published rule version is immutable")
)

type HouseRuleRepository struct {
	db *pgxpool.Pool
}

func NewHouseRuleRepository(db *pgxpool.Pool) *HouseRuleRepository {
	return &HouseRuleRepository{db: db}
}

// EnsureRuleSet creates a rule set for a property if one doesn't exist yet
func (r *HouseRuleRepository) EnsureRuleSet(ctx context.Context, propertyID uuid.UUID, title, description string) (*model.RuleSet, error) {
	if title == "" {
		title = "Peraturan Tata Tertib Kos"
	}
	rs := &model.RuleSet{}
	query := `
		INSERT INTO rule_sets (property_id, title, description)
		VALUES ($1, $2, NULLIF($3, ''))
		ON CONFLICT (property_id) DO UPDATE SET updated_at = NOW()
		RETURNING id, property_id, title, description, created_at, updated_at`
	err := r.db.QueryRow(ctx, query, propertyID, title, description).Scan(
		&rs.ID, &rs.PropertyID, &rs.Title, &rs.Description, &rs.CreatedAt, &rs.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("ensure rule set: %w", err)
	}
	return rs, nil
}

// GetRuleSet returns the rule set container for a property
func (r *HouseRuleRepository) GetRuleSet(ctx context.Context, propertyID uuid.UUID) (*model.RuleSet, error) {
	rs := &model.RuleSet{}
	query := `SELECT id, property_id, title, description, created_at, updated_at FROM rule_sets WHERE property_id = $1`
	err := r.db.QueryRow(ctx, query, propertyID).Scan(
		&rs.ID, &rs.PropertyID, &rs.Title, &rs.Description, &rs.CreatedAt, &rs.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return rs, nil
}

// GetActivePublishedVersion returns the active published version and its items
func (r *HouseRuleRepository) GetActivePublishedVersion(ctx context.Context, propertyID uuid.UUID) (*model.RuleVersion, error) {
	query := `
		SELECT rv.id, rv.rule_set_id, rv.property_id, rv.version_number, rv.status,
		       rv.effective_from, rv.change_summary, rv.published_by, u.name, rv.published_at,
		       rv.created_at, rv.updated_at
		FROM rule_versions rv
		LEFT JOIN users u ON u.id = rv.published_by
		WHERE rv.property_id = $1 AND rv.status = 'published'
		ORDER BY rv.version_number DESC
		LIMIT 1`
	v := &model.RuleVersion{}
	err := r.db.QueryRow(ctx, query, propertyID).Scan(
		&v.ID, &v.RuleSetID, &v.PropertyID, &v.VersionNumber, &v.Status,
		&v.EffectiveFrom, &v.ChangeSummary, &v.PublishedBy, &v.PublishedByName, &v.PublishedAt,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	items, err := r.getItemsByVersionID(ctx, v.ID)
	if err != nil {
		return nil, err
	}
	v.Items = items
	v.TotalItems = len(items)
	return v, nil
}

// GetDraftVersion returns the draft version if exists
func (r *HouseRuleRepository) GetDraftVersion(ctx context.Context, propertyID uuid.UUID) (*model.RuleVersion, error) {
	query := `
		SELECT rv.id, rv.rule_set_id, rv.property_id, rv.version_number, rv.status,
		       rv.effective_from, rv.change_summary, rv.published_by, u.name, rv.published_at,
		       rv.created_at, rv.updated_at
		FROM rule_versions rv
		LEFT JOIN users u ON u.id = rv.published_by
		WHERE rv.property_id = $1 AND rv.status = 'draft'
		LIMIT 1`
	v := &model.RuleVersion{}
	err := r.db.QueryRow(ctx, query, propertyID).Scan(
		&v.ID, &v.RuleSetID, &v.PropertyID, &v.VersionNumber, &v.Status,
		&v.EffectiveFrom, &v.ChangeSummary, &v.PublishedBy, &v.PublishedByName, &v.PublishedAt,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	items, err := r.getItemsByVersionID(ctx, v.ID)
	if err != nil {
		return nil, err
	}
	v.Items = items
	v.TotalItems = len(items)
	return v, nil
}

// ListVersions returns all versions of rules for a property ordered by version number DESC
func (r *HouseRuleRepository) ListVersions(ctx context.Context, propertyID uuid.UUID) ([]model.RuleVersion, error) {
	query := `
		SELECT rv.id, rv.rule_set_id, rv.property_id, rv.version_number, rv.status,
		       rv.effective_from, rv.change_summary, rv.published_by, u.name, rv.published_at,
		       rv.created_at, rv.updated_at,
		       (SELECT COUNT(*) FROM rule_items WHERE rule_version_id = rv.id) AS total_items
		FROM rule_versions rv
		LEFT JOIN users u ON u.id = rv.published_by
		WHERE rv.property_id = $1
		ORDER BY rv.version_number DESC`
	rows, err := r.db.Query(ctx, query, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []model.RuleVersion
	for rows.Next() {
		var v model.RuleVersion
		if err := rows.Scan(
			&v.ID, &v.RuleSetID, &v.PropertyID, &v.VersionNumber, &v.Status,
			&v.EffectiveFrom, &v.ChangeSummary, &v.PublishedBy, &v.PublishedByName, &v.PublishedAt,
			&v.CreatedAt, &v.UpdatedAt, &v.TotalItems,
		); err != nil {
			return nil, err
		}
		v.Items = []model.RuleItem{}
		versions = append(versions, v)
	}
	if versions == nil {
		versions = []model.RuleVersion{}
	}
	return versions, nil
}

// GetVersion returns a specific version and its items
func (r *HouseRuleRepository) GetVersion(ctx context.Context, propertyID, versionID uuid.UUID) (*model.RuleVersion, error) {
	query := `
		SELECT rv.id, rv.rule_set_id, rv.property_id, rv.version_number, rv.status,
		       rv.effective_from, rv.change_summary, rv.published_by, u.name, rv.published_at,
		       rv.created_at, rv.updated_at
		FROM rule_versions rv
		LEFT JOIN users u ON u.id = rv.published_by
		WHERE rv.id = $1 AND rv.property_id = $2`
	v := &model.RuleVersion{}
	err := r.db.QueryRow(ctx, query, versionID, propertyID).Scan(
		&v.ID, &v.RuleSetID, &v.PropertyID, &v.VersionNumber, &v.Status,
		&v.EffectiveFrom, &v.ChangeSummary, &v.PublishedBy, &v.PublishedByName, &v.PublishedAt,
		&v.CreatedAt, &v.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRuleVersionNotFound
		}
		return nil, err
	}

	items, err := r.getItemsByVersionID(ctx, v.ID)
	if err != nil {
		return nil, err
	}
	v.Items = items
	v.TotalItems = len(items)
	return v, nil
}

// SaveDraft saves or updates a draft version with its items
func (r *HouseRuleRepository) SaveDraft(ctx context.Context, propertyID, actorID uuid.UUID, req model.SaveDraftRulesRequest) (*model.RuleVersion, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Ensure rule_set exists
	var ruleSetID uuid.UUID
	title := req.Title
	if title == "" {
		title = "Peraturan Tata Tertib Kos"
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO rule_sets (property_id, title, description)
		VALUES ($1, $2, NULLIF($3, ''))
		ON CONFLICT (property_id) DO UPDATE SET 
			title = EXCLUDED.title,
			description = COALESCE(EXCLUDED.description, rule_sets.description),
			updated_at = NOW()
		RETURNING id`, propertyID, title, req.Description).Scan(&ruleSetID)
	if err != nil {
		return nil, fmt.Errorf("upsert rule set: %w", err)
	}

	// Check if draft already exists
	var draftID uuid.UUID
	var versionNumber int
	err = tx.QueryRow(ctx, `SELECT id, version_number FROM rule_versions WHERE rule_set_id = $1 AND status = 'draft' FOR UPDATE`, ruleSetID).Scan(&draftID, &versionNumber)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		// New draft: version_number = MAX(version_number) + 1
		err = tx.QueryRow(ctx, `SELECT COALESCE(MAX(version_number), 0) + 1 FROM rule_versions WHERE rule_set_id = $1`, ruleSetID).Scan(&versionNumber)
		if err != nil {
			return nil, err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO rule_versions (rule_set_id, property_id, version_number, status, change_summary, updated_at)
			VALUES ($1, $2, $3, 'draft', NULLIF($4, ''), NOW())
			RETURNING id`, ruleSetID, propertyID, versionNumber, req.ChangeSummary).Scan(&draftID)
		if err != nil {
			return nil, fmt.Errorf("create draft version: %w", err)
		}
	} else {
		// Existing draft: update summary and timestamp
		_, err = tx.Exec(ctx, `
			UPDATE rule_versions 
			SET change_summary = COALESCE(NULLIF($1, ''), change_summary), updated_at = NOW()
			WHERE id = $2`, req.ChangeSummary, draftID)
		if err != nil {
			return nil, err
		}
		// Delete existing draft items to replace with updated list
		_, err = tx.Exec(ctx, `DELETE FROM rule_items WHERE rule_version_id = $1`, draftID)
		if err != nil {
			return nil, err
		}
	}

	// Insert items
	for idx, item := range req.Items {
		orderIdx := item.OrderIndex
		if orderIdx <= 0 {
			orderIdx = idx + 1
		}
		severity := item.Severity
		if severity == "" {
			severity = model.RuleSeverityStandard
		}
		details := item.Details
		if details == nil {
			details = []string{}
		}
		_, err = tx.Exec(ctx, `
			INSERT INTO rule_items (
				rule_version_id, category, title, description, details, severity, order_index, penalty_description
			) VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8, ''))`,
			draftID, item.Category, item.Title, item.Description, details, severity, orderIdx, item.PenaltyDescription,
		)
		if err != nil {
			return nil, fmt.Errorf("insert rule item: %w", err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetVersion(ctx, propertyID, draftID)
}

// PublishDraft marks a draft version as published and supersedes previous published versions
func (r *HouseRuleRepository) PublishDraft(ctx context.Context, propertyID, actorID uuid.UUID, versionID uuid.UUID, effectiveFrom *time.Time, changeSummary string) (*model.RuleVersion, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var ruleSetID uuid.UUID
	var status string
	var versionNumber int
	err = tx.QueryRow(ctx, `
		SELECT rule_set_id, status, version_number 
		FROM rule_versions 
		WHERE id = $1 AND property_id = $2 FOR UPDATE`, versionID, propertyID).Scan(&ruleSetID, &status, &versionNumber)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRuleVersionNotFound
		}
		return nil, err
	}

	if status != model.RuleStatusDraft {
		return nil, fmt.Errorf("version %d is already %s and cannot be published", versionNumber, status)
	}

	// Verify item count > 0
	var itemCount int
	err = tx.QueryRow(ctx, `SELECT COUNT(*) FROM rule_items WHERE rule_version_id = $1`, versionID).Scan(&itemCount)
	if err != nil {
		return nil, err
	}
	if itemCount == 0 {
		return nil, ErrEmptyRules
	}

	// Transition previous published version to superseded
	_, err = tx.Exec(ctx, `
		UPDATE rule_versions 
		SET status = 'superseded', updated_at = NOW() 
		WHERE rule_set_id = $1 AND status = 'published'`, ruleSetID)
	if err != nil {
		return nil, fmt.Errorf("supersede previous version: %w", err)
	}

	now := time.Now().UTC()
	effDate := now
	if effectiveFrom != nil && !effectiveFrom.IsZero() {
		effDate = *effectiveFrom
	}

	// Update draft to published
	_, err = tx.Exec(ctx, `
		UPDATE rule_versions
		SET status = 'published',
		    effective_from = $1,
		    published_by = $2,
		    published_at = $3,
		    change_summary = COALESCE(NULLIF($4, ''), change_summary),
		    updated_at = $3
		WHERE id = $5`, effDate, actorID, now, changeSummary, versionID)
	if err != nil {
		return nil, fmt.Errorf("publish draft: %w", err)
	}

	// Insert into notification_outbox for async broadcast (Epic 08 integration)
	_, _ = tx.Exec(ctx, `
		INSERT INTO notification_outbox (property_id, event_type, aggregate_type, aggregate_id, payload, status)
		VALUES ($1, 'rule_version_published', 'rule_version', $2, jsonb_build_object(
			'version_number', $3::int,
			'effective_from', $4::timestamptz,
			'change_summary', $5::text
		), 'pending')`, propertyID, versionID, versionNumber, effDate, changeSummary)

	// Insert in-app notifications for active tenants
	_, _ = tx.Exec(ctx, `
		INSERT INTO in_app_notifications (property_id, user_id, category, title, message, action_url, metadata)
		SELECT c.property_id, c.user_id, 'announcement', 
		       'Peraturan Kos Diperbarui (Versi ' || $3 || ')',
		       'Telah diterbitkan versi baru peraturan kos. Silakan tinjau dan konfirmasi peraturan.',
		       '/rules',
		       jsonb_build_object('rule_version_id', $2::text, 'version_number', $3::int)
		FROM contracts c
		WHERE c.property_id = $1 AND c.status = 'active'`, propertyID, versionID, versionNumber)

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.GetVersion(ctx, propertyID, versionID)
}

// AcknowledgeVersion records tenant consent for a published rule version
func (r *HouseRuleRepository) AcknowledgeVersion(ctx context.Context, propertyID, tenantUserID uuid.UUID, contractID *uuid.UUID, versionID uuid.UUID, sourceIP, userAgent, consentText string) (*model.RuleAcknowledgment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Verify version exists and is published
	var versionNumber int
	err = tx.QueryRow(ctx, `
		SELECT version_number FROM rule_versions 
		WHERE id = $1 AND property_id = $2 AND status = 'published'`, versionID, propertyID).Scan(&versionNumber)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("active published rule version not found: %w", ErrRuleVersionNotFound)
		}
		return nil, err
	}

	if consentText == "" {
		consentText = fmt.Sprintf("Saya telah membaca, memahami, dan menyetujui Peraturan Tata Tertib Kos Versi %d.", versionNumber)
	}

	// Check if acknowledgment already exists
	ack := &model.RuleAcknowledgment{}
	var checkQuery string
	var checkArgs []any
	if contractID != nil {
		checkQuery = `SELECT id, property_id, rule_version_id, tenant_user_id, contract_id, acknowledged_at, COALESCE(source_ip,''), COALESCE(user_agent,''), consent_text, amendment_notes, created_at FROM rule_acknowledgments WHERE property_id = $1 AND rule_version_id = $2 AND tenant_user_id = $3 AND contract_id = $4`
		checkArgs = []any{propertyID, versionID, tenantUserID, *contractID}
	} else {
		checkQuery = `SELECT id, property_id, rule_version_id, tenant_user_id, contract_id, acknowledged_at, COALESCE(source_ip,''), COALESCE(user_agent,''), consent_text, amendment_notes, created_at FROM rule_acknowledgments WHERE property_id = $1 AND rule_version_id = $2 AND tenant_user_id = $3 AND contract_id IS NULL`
		checkArgs = []any{propertyID, versionID, tenantUserID}
	}
	err = tx.QueryRow(ctx, checkQuery, checkArgs...).Scan(
		&ack.ID, &ack.PropertyID, &ack.RuleVersionID, &ack.TenantUserID,
		&ack.ContractID, &ack.AcknowledgedAt, &ack.SourceIP, &ack.UserAgent,
		&ack.ConsentText, &ack.AmendmentNotes, &ack.CreatedAt,
	)
	if err == nil {
		ack.VersionNumber = versionNumber
		return ack, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	query := `
		INSERT INTO rule_acknowledgments (
			property_id, rule_version_id, tenant_user_id, contract_id,
			source_ip, user_agent, consent_text
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, property_id, rule_version_id, tenant_user_id, contract_id, acknowledged_at, source_ip, user_agent, consent_text, amendment_notes, created_at`
	err = tx.QueryRow(ctx, query, propertyID, versionID, tenantUserID, contractID, sourceIP, userAgent, consentText).Scan(
		&ack.ID, &ack.PropertyID, &ack.RuleVersionID, &ack.TenantUserID, &ack.ContractID,
		&ack.AcknowledgedAt, &ack.SourceIP, &ack.UserAgent, &ack.ConsentText, &ack.AmendmentNotes, &ack.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("record rule acknowledgment: %w", err)
	}

	ack.VersionNumber = versionNumber

	// If contractID is provided, update contract's rule_version_id and rule_acknowledged_at
	if contractID != nil {
		_, err = tx.Exec(ctx, `
			UPDATE contracts 
			SET rule_version_id = $1, rule_acknowledged_at = COALESCE(rule_acknowledged_at, NOW())
			WHERE id = $2 AND property_id = $3`, versionID, *contractID, propertyID)
		if err != nil {
			return nil, fmt.Errorf("update contract rule version: %w", err)
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}

	return ack, nil
}

// GetTenantAcknowledgment returns acknowledgment record for a tenant
func (r *HouseRuleRepository) GetTenantAcknowledgment(ctx context.Context, propertyID, tenantUserID, versionID uuid.UUID, contractID *uuid.UUID) (*model.RuleAcknowledgment, error) {
	ack := &model.RuleAcknowledgment{}
	var query string
	var args []any
	if contractID != nil {
		query = `
			SELECT ra.id, ra.property_id, ra.rule_version_id, rv.version_number, ra.tenant_user_id,
			       ra.contract_id, ra.acknowledged_at, ra.source_ip, ra.user_agent, ra.consent_text,
			       ra.amendment_notes, ra.created_at
			FROM rule_acknowledgments ra
			JOIN rule_versions rv ON rv.id = ra.rule_version_id
			WHERE ra.property_id = $1 AND ra.rule_version_id = $2 AND ra.tenant_user_id = $3 AND (ra.contract_id = $4 OR ra.contract_id IS NULL)
			ORDER BY ra.acknowledged_at DESC
			LIMIT 1`
		args = []any{propertyID, versionID, tenantUserID, *contractID}
	} else {
		query = `
			SELECT ra.id, ra.property_id, ra.rule_version_id, rv.version_number, ra.tenant_user_id,
			       ra.contract_id, ra.acknowledged_at, ra.source_ip, ra.user_agent, ra.consent_text,
			       ra.amendment_notes, ra.created_at
			FROM rule_acknowledgments ra
			JOIN rule_versions rv ON rv.id = ra.rule_version_id
			WHERE ra.property_id = $1 AND ra.rule_version_id = $2 AND ra.tenant_user_id = $3
			ORDER BY ra.acknowledged_at DESC
			LIMIT 1`
		args = []any{propertyID, versionID, tenantUserID}
	}

	err := r.db.QueryRow(ctx, query, args...).Scan(
		&ack.ID, &ack.PropertyID, &ack.RuleVersionID, &ack.VersionNumber, &ack.TenantUserID,
		&ack.ContractID, &ack.AcknowledgedAt, &ack.SourceIP, &ack.UserAgent, &ack.ConsentText,
		&ack.AmendmentNotes, &ack.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return ack, nil
}

// ListAcknowledgments returns audit trail of all tenant acknowledgments for a version
func (r *HouseRuleRepository) ListAcknowledgments(ctx context.Context, propertyID, versionID uuid.UUID) ([]model.RuleAcknowledgment, error) {
	query := `
		SELECT ra.id, ra.property_id, ra.rule_version_id, rv.version_number, ra.tenant_user_id,
		       COALESCE(p.full_name, u.name, 'Tenant') AS tenant_name,
		       COALESCE(p.email, u.email, '') AS tenant_email,
		       COALESCE(p.phone, u.phone, '') AS tenant_phone,
		       COALESCE(rm.room_number, '-') AS room_number,
		       ra.contract_id, ra.acknowledged_at, COALESCE(ra.source_ip, '') AS source_ip,
		       COALESCE(ra.user_agent, '') AS user_agent, ra.consent_text, ra.amendment_notes, ra.created_at
		FROM rule_acknowledgments ra
		JOIN rule_versions rv ON rv.id = ra.rule_version_id
		LEFT JOIN tenant_profiles p ON p.user_id = ra.tenant_user_id AND p.property_id = ra.property_id
		LEFT JOIN users u ON u.id = ra.tenant_user_id
		LEFT JOIN contracts c ON c.id = ra.contract_id
		LEFT JOIN rooms rm ON rm.id = c.room_id
		WHERE ra.property_id = $1 AND ra.rule_version_id = $2
		ORDER BY ra.acknowledged_at DESC`
	rows, err := r.db.Query(ctx, query, propertyID, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var acks []model.RuleAcknowledgment
	for rows.Next() {
		var a model.RuleAcknowledgment
		if err := rows.Scan(
			&a.ID, &a.PropertyID, &a.RuleVersionID, &a.VersionNumber, &a.TenantUserID,
			&a.TenantName, &a.TenantEmail, &a.TenantPhone, &a.RoomNumber,
			&a.ContractID, &a.AcknowledgedAt, &a.SourceIP,
			&a.UserAgent, &a.ConsentText, &a.AmendmentNotes, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		acks = append(acks, a)
	}
	if acks == nil {
		acks = []model.RuleAcknowledgment{}
	}
	return acks, nil
}

func (r *HouseRuleRepository) getItemsByVersionID(ctx context.Context, versionID uuid.UUID) ([]model.RuleItem, error) {
	query := `
		SELECT id, rule_version_id, category, title, description, details, severity, order_index, penalty_description, created_at
		FROM rule_items
		WHERE rule_version_id = $1
		ORDER BY order_index ASC, created_at ASC`
	rows, err := r.db.Query(ctx, query, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []model.RuleItem
	for rows.Next() {
		var item model.RuleItem
		if err := rows.Scan(
			&item.ID, &item.RuleVersionID, &item.Category, &item.Title, &item.Description,
			&item.Details, &item.Severity, &item.OrderIndex, &item.PenaltyDescription, &item.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if items == nil {
		items = []model.RuleItem{}
	}
	return items, nil
}

// FindAllByProperty returns rules without ANY database modification (AC 1)
func (r *HouseRuleRepository) FindAllByProperty(ctx context.Context, propertyID uuid.UUID) ([]model.HouseRule, error) {
	// First check if an active published version exists
	activeVer, err := r.GetActivePublishedVersion(ctx, propertyID)
	if err != nil {
		return nil, err
	}
	if activeVer != nil && len(activeVer.Items) > 0 {
		var result []model.HouseRule
		for _, it := range activeVer.Items {
			result = append(result, model.HouseRule{
				ID:          it.ID,
				PropertyID:  propertyID,
				Category:    it.Category,
				Title:       it.Title,
				Description: it.Description,
				Details:     it.Details,
				CreatedAt:   it.CreatedAt,
			})
		}
		return result, nil
	}

	// Fallback to legacy house_rules table if present
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

// FindByID returns a rule by ID (legacy support)
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

// Create creates a single house rule in legacy table
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

// BulkCreate creates multiple house rules in legacy table
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

// Update updates a house rule in legacy table
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

// Delete removes a house rule from legacy table
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

// FindActiveContractContextByTenant finds tenant's active property and owner
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
