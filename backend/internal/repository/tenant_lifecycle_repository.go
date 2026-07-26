package repository

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
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
	ErrInvitationUnavailable = errors.New("invitation is invalid, expired, or no longer available")
	ErrProfileAlreadyActive  = errors.New("tenant profile is already active")
	ErrDocumentNotFound      = errors.New("tenant document not found")
	ErrDocumentAuditFailed   = errors.New("tenant document access audit failed")
)

type TenantLifecycleRepository struct{ db *pgxpool.Pool }

func NewTenantLifecycleRepository(db *pgxpool.Pool) *TenantLifecycleRepository {
	return &TenantLifecycleRepository{db: db}
}

func InvitationDigest(token string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(token)))
	return hex.EncodeToString(sum[:])
}

func (r *TenantLifecycleRepository) CreateInvitation(ctx context.Context, propertyID, actorID uuid.UUID, req model.CreateTenantInvitationRequest, tokenDigest string, expiresAt time.Time) (*model.TenantInvitation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	email := strings.ToLower(strings.TrimSpace(req.Email))
	phone := strings.TrimSpace(req.Phone)
	deliveryMethod := strings.TrimSpace(req.DeliveryMethod)
	name := strings.TrimSpace(req.FullName)
	if name == "" || (deliveryMethod != "email" && deliveryMethod != "whatsapp") {
		return nil, fmt.Errorf("tenant name and delivery method are required")
	}
	if deliveryMethod == "email" && email == "" {
		return nil, fmt.Errorf("email is required for email delivery")
	}
	if deliveryMethod == "whatsapp" && phone == "" {
		return nil, fmt.Errorf("phone is required for WhatsApp delivery")
	}

	var profileID uuid.UUID
	var status string
	lookupQuery, lookupValue := `SELECT id,status FROM tenant_profiles WHERE property_id=$1 AND LOWER(email)=LOWER($2) FOR UPDATE`, email
	if deliveryMethod == "whatsapp" {
		lookupQuery, lookupValue = `SELECT id,status FROM tenant_profiles WHERE property_id=$1 AND phone=$2 FOR UPDATE`, phone
	}
	err = tx.QueryRow(ctx, lookupQuery, propertyID, lookupValue).Scan(&profileID, &status)
	if err == pgx.ErrNoRows {
		var profileEmail any
		if email != "" {
			profileEmail = email
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO tenant_profiles (property_id,full_name,email,phone,status,created_by)
			VALUES ($1,$2,$3,$4,'invited',$5) RETURNING id`, propertyID, name, profileEmail, phone, actorID).Scan(&profileID)
	} else if err == nil {
		if status == "active" {
			return nil, ErrProfileAlreadyActive
		}
		var profileEmail any
		if email != "" {
			profileEmail = email
		}
		_, err = tx.Exec(ctx, `UPDATE tenant_profiles SET full_name=$1,email=COALESCE($2,email),phone=$3,status='invited',updated_at=NOW() WHERE id=$4`, name, profileEmail, phone, profileID)
	}
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE tenant_invitations SET status='revoked',revoked_at=NOW() WHERE tenant_profile_id=$1 AND status='pending'`, profileID); err != nil {
		return nil, err
	}

	invitation := &model.TenantInvitation{PropertyID: propertyID, TenantProfileID: profileID, FullName: name, Email: email, Phone: phone, DeliveryMethod: deliveryMethod, Status: "pending", ExpiresAt: expiresAt}
	err = tx.QueryRow(ctx, `
		INSERT INTO tenant_invitations (property_id,tenant_profile_id,token_digest,status,expires_at,created_by,delivery_method)
		VALUES ($1,$2,$3,'pending',$4,$5,$6) RETURNING id,created_at`, propertyID, profileID, tokenDigest, expiresAt, actorID, deliveryMethod).Scan(&invitation.ID, &invitation.CreatedAt)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return invitation, nil
}

func (r *TenantLifecycleRepository) ListInvitations(ctx context.Context, propertyID uuid.UUID) ([]model.TenantInvitation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT i.id,i.property_id,i.tenant_profile_id,p.full_name,COALESCE(p.email,''),p.phone,i.delivery_method,
			CASE WHEN i.status='pending' AND i.expires_at <= NOW() THEN 'expired' ELSE i.status END,
			i.expires_at,i.used_at,i.created_at
		FROM tenant_invitations i JOIN tenant_profiles p ON p.id=i.tenant_profile_id
		WHERE i.property_id=$1 ORDER BY i.created_at DESC`, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]model.TenantInvitation, 0)
	for rows.Next() {
		var invitation model.TenantInvitation
		if err := rows.Scan(&invitation.ID, &invitation.PropertyID, &invitation.TenantProfileID, &invitation.FullName, &invitation.Email, &invitation.Phone, &invitation.DeliveryMethod, &invitation.Status, &invitation.ExpiresAt, &invitation.UsedAt, &invitation.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, invitation)
	}
	return result, rows.Err()
}

func (r *TenantLifecycleRepository) RevokeInvitation(ctx context.Context, propertyID, invitationID uuid.UUID) error {
	command, err := r.db.Exec(ctx, `UPDATE tenant_invitations SET status='revoked',revoked_at=NOW() WHERE id=$1 AND property_id=$2 AND status='pending'`, invitationID, propertyID)
	return requireOne(command, err)
}

// PreviewInvitation returns only the data required for an activation screen;
// private profile documents and global identity data are deliberately omitted.
func (r *TenantLifecycleRepository) PreviewInvitation(ctx context.Context, digest string) (*model.TenantInvitation, error) {
	invitation := &model.TenantInvitation{}
	err := r.db.QueryRow(ctx, `
		SELECT i.id,i.property_id,i.tenant_profile_id,p.full_name,COALESCE(p.email,''),p.phone,i.delivery_method,
			CASE WHEN i.status='pending' AND i.expires_at > NOW() THEN 'pending' ELSE 'unavailable' END,
			i.expires_at,i.used_at,i.created_at
		FROM tenant_invitations i JOIN tenant_profiles p ON p.id=i.tenant_profile_id
		WHERE i.token_digest=$1`, digest).Scan(&invitation.ID, &invitation.PropertyID, &invitation.TenantProfileID, &invitation.FullName, &invitation.Email, &invitation.Phone, &invitation.DeliveryMethod, &invitation.Status, &invitation.ExpiresAt, &invitation.UsedAt, &invitation.CreatedAt)
	if err != nil {
		return nil, ErrInvitationUnavailable
	}
	if invitation.Status != "pending" {
		return nil, ErrInvitationUnavailable
	}
	return invitation, nil
}

// IsInvitationActivationVerified is safe for the activation page because the
// invitation token is already a high-entropy, single-use capability.
func (r *TenantLifecycleRepository) IsInvitationActivationVerified(ctx context.Context, digest string) (bool, error) {
	var verified bool
	err := r.db.QueryRow(ctx, `
		SELECT u.is_verified
		FROM tenant_invitations i
		JOIN tenant_profiles p ON p.id=i.tenant_profile_id
		JOIN users u ON u.id=p.user_id
		WHERE i.token_digest=$1 AND i.status='accepted'`, digest).Scan(&verified)
	if err != nil {
		return false, ErrInvitationUnavailable
	}
	return verified, nil
}

type ActivationInput struct {
	TokenDigest     string
	PasswordHash    string
	VerificationKey string
	ExistingUserID  *uuid.UUID
	Email           string
	PolicyVersion   string
	SourceIP        string
	UserAgent       string
}

type ActivationResult struct {
	UserID               uuid.UUID
	Email                string
	NewAccount           bool
	RequiresVerification bool
}

// ActivateInvitation consumes an invitation inside the same transaction that
// links (or creates) the global identity and writes the policy consent.
func (r *TenantLifecycleRepository) ActivateInvitation(ctx context.Context, input ActivationInput) (*ActivationResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var invitationID, propertyID, profileID uuid.UUID
	var status string
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `SELECT id,property_id,tenant_profile_id,status,expires_at FROM tenant_invitations WHERE token_digest=$1 FOR UPDATE`, input.TokenDigest).Scan(&invitationID, &propertyID, &profileID, &status, &expiresAt)
	if err != nil || status != "pending" || !expiresAt.After(time.Now()) {
		return nil, ErrInvitationUnavailable
	}

	var name, email, profileStatus string
	var linkedUserID *uuid.UUID
	if err = tx.QueryRow(ctx, `SELECT full_name,COALESCE(email,''),status,user_id FROM tenant_profiles WHERE id=$1 AND property_id=$2 FOR UPDATE`, profileID, propertyID).Scan(&name, &email, &profileStatus, &linkedUserID); err != nil {
		return nil, err
	}
	if email == "" {
		email = strings.ToLower(strings.TrimSpace(input.Email))
		if email == "" {
			return nil, fmt.Errorf("email is required to activate the account")
		}
		if _, err = tx.Exec(ctx, `UPDATE tenant_profiles SET email=$1,updated_at=NOW() WHERE id=$2`, email, profileID); err != nil {
			return nil, err
		}
	}
	if profileStatus == "active" {
		return nil, ErrProfileAlreadyActive
	}
	if linkedUserID != nil && (input.ExistingUserID == nil || *linkedUserID != *input.ExistingUserID) {
		return nil, ErrInvitationUnavailable
	}

	result := &ActivationResult{Email: email}
	if input.ExistingUserID != nil {
		var existingEmail string
		if err = tx.QueryRow(ctx, `SELECT email FROM users WHERE id=$1 AND is_active=TRUE AND is_verified=TRUE`, *input.ExistingUserID).Scan(&existingEmail); err != nil || !strings.EqualFold(existingEmail, email) {
			return nil, ErrInvitationUnavailable
		}
		result.UserID = *input.ExistingUserID
	} else {
		if input.PasswordHash == "" || input.VerificationKey == "" {
			return nil, fmt.Errorf("password and verification key are required")
		}
		if err = tx.QueryRow(ctx, `
			INSERT INTO users (name,email,password_hash,role,is_verified,verification_token,phone,is_active)
			VALUES ($1,LOWER($2),$3,'tenant',FALSE,$4,'',TRUE) RETURNING id`, name, email, input.PasswordHash, input.VerificationKey).Scan(&result.UserID); err != nil {
			return nil, err
		}
		result.NewAccount, result.RequiresVerification = true, true
	}

	if _, err = tx.Exec(ctx, `UPDATE tenant_profiles SET user_id=$1,status='active',activated_at=NOW(),updated_at=NOW() WHERE id=$2`, result.UserID, profileID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE tenant_invitations SET status='accepted',used_at=NOW() WHERE id=$1`, invitationID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO tenant_consent_records (property_id,tenant_profile_id,user_id,policy_type,policy_version,source_ip,user_agent)
		VALUES ($1,$2,$3,'tenant_activation',$4,NULLIF($5,'')::inet,$6)`, propertyID, profileID, result.UserID, strings.TrimSpace(input.PolicyVersion), input.SourceIP, input.UserAgent); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return result, nil
}

func (r *TenantLifecycleRepository) ListProfiles(ctx context.Context, propertyID uuid.UUID) ([]model.TenantProfile, error) {
	rows, err := r.db.Query(ctx, `SELECT id,property_id,user_id,full_name,COALESCE(email,''),phone,status,activated_at,created_at FROM tenant_profiles WHERE property_id=$1 ORDER BY created_at DESC`, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	profiles := make([]model.TenantProfile, 0)
	for rows.Next() {
		var profile model.TenantProfile
		if err := rows.Scan(&profile.ID, &profile.PropertyID, &profile.UserID, &profile.FullName, &profile.Email, &profile.Phone, &profile.Status, &profile.ActivatedAt, &profile.CreatedAt); err != nil {
			return nil, err
		}
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}

func (r *TenantLifecycleRepository) CreateDocument(ctx context.Context, propertyID, profileID, uploadedBy uuid.UUID, documentType, objectKey, mimeType, checksum string, size int64) (*model.TenantDocument, error) {
	if documentType != "ktp" && documentType != "selfie" && documentType != "supporting" {
		return nil, fmt.Errorf("unsupported tenant document type")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM tenant_profiles WHERE id=$1 AND property_id=$2)`, profileID, propertyID).Scan(&exists); err != nil || !exists {
		return nil, ErrDocumentNotFound
	}
	var fileID uuid.UUID
	if err = tx.QueryRow(ctx, `INSERT INTO files (property_id,uploaded_by,object_key,mime_type,size_bytes,checksum_sha256,visibility) VALUES ($1,$2,$3,$4,$5,$6,'tenant') RETURNING id`, propertyID, uploadedBy, objectKey, mimeType, size, checksum).Scan(&fileID); err != nil {
		return nil, err
	}
	document := &model.TenantDocument{FileID: fileID, DocumentType: documentType, FileName: objectKey, MimeType: mimeType, SizeBytes: size}
	if err = tx.QueryRow(ctx, `INSERT INTO tenant_documents (property_id,tenant_profile_id,file_id,document_type,uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id,created_at`, propertyID, profileID, fileID, documentType, uploadedBy).Scan(&document.ID, &document.CreatedAt); err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return document, nil
}

func (r *TenantLifecycleRepository) ListDocuments(ctx context.Context, propertyID, profileID uuid.UUID) ([]model.TenantDocument, error) {
	rows, err := r.db.Query(ctx, `SELECT d.id,d.file_id,d.document_type,f.object_key,f.mime_type,f.size_bytes,d.created_at FROM tenant_documents d JOIN files f ON f.id=d.file_id AND f.deleted_at IS NULL WHERE d.property_id=$1 AND d.tenant_profile_id=$2 ORDER BY d.created_at DESC`, propertyID, profileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]model.TenantDocument, 0)
	for rows.Next() {
		var d model.TenantDocument
		if err := rows.Scan(&d.ID, &d.FileID, &d.DocumentType, &d.FileName, &d.MimeType, &d.SizeBytes, &d.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, d)
	}
	return result, rows.Err()
}

func (r *TenantLifecycleRepository) DocumentObjectKey(ctx context.Context, propertyID, profileID, documentID, actorID uuid.UUID, tenantSelf bool, requestID string) (string, error) {
	query := `SELECT f.object_key FROM tenant_documents d JOIN files f ON f.id=d.file_id AND f.deleted_at IS NULL JOIN tenant_profiles p ON p.id=d.tenant_profile_id WHERE d.id=$1 AND d.property_id=$2 AND d.tenant_profile_id=$3`
	args := []any{documentID, propertyID, profileID}
	if tenantSelf {
		query += ` AND p.user_id=$4`
		args = append(args, actorID)
	}
	var objectKey string
	if err := r.db.QueryRow(ctx, query, args...).Scan(&objectKey); err != nil {
		return "", ErrDocumentNotFound
	}
	if _, err := r.db.Exec(ctx, `INSERT INTO tenant_document_access_logs (tenant_document_id,accessed_by,action,request_id) VALUES ($1,$2,'signed_url',$3)`, documentID, actorID, requestID); err != nil {
		return "", fmt.Errorf("%w: %v", ErrDocumentAuditFailed, err)
	}
	return objectKey, nil
}

func (r *TenantLifecycleRepository) MyDocumentContext(ctx context.Context, userID, documentID uuid.UUID) (propertyID, profileID uuid.UUID, err error) {
	err = r.db.QueryRow(ctx, `SELECT d.property_id,d.tenant_profile_id FROM tenant_documents d JOIN tenant_profiles p ON p.id=d.tenant_profile_id WHERE d.id=$1 AND p.user_id=$2 AND p.status='active'`, documentID, userID).Scan(&propertyID, &profileID)
	if err != nil {
		return uuid.Nil, uuid.Nil, ErrDocumentNotFound
	}
	return propertyID, profileID, nil
}
