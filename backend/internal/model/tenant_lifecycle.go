package model

import (
	"time"

	"github.com/google/uuid"
)

type TenantProfile struct {
	ID          uuid.UUID  `json:"id"`
	PropertyID  uuid.UUID  `json:"property_id"`
	UserID      *uuid.UUID `json:"user_id,omitempty"`
	FullName    string     `json:"full_name"`
	Email       string     `json:"email"`
	Phone       string     `json:"phone"`
	Status      string     `json:"status"`
	ActivatedAt *time.Time `json:"activated_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type CreateTenantInvitationRequest struct {
	FullName       string `json:"full_name" binding:"required"`
	Email          string `json:"email"`
	Phone          string `json:"phone"`
	DeliveryMethod string `json:"delivery_method" binding:"required"`
	ExpiresInHours int    `json:"expires_in_hours"`
}

type ActivateTenantInvitationRequest struct {
	Token string `json:"token" binding:"required"`
	// Password is required only when the invitation creates a new global
	// identity. Existing users prove ownership with ExistingPassword instead.
	Password         string `json:"password"`
	ExistingPassword string `json:"existing_password"`
	Email            string `json:"email"`
	PolicyVersion    string `json:"policy_version" binding:"required"`
	PolicyAccepted   bool   `json:"policy_accepted"`
}

type TenantInvitation struct {
	ID              uuid.UUID  `json:"id"`
	PropertyID      uuid.UUID  `json:"property_id"`
	TenantProfileID uuid.UUID  `json:"tenant_profile_id"`
	FullName        string     `json:"full_name"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone"`
	DeliveryMethod  string     `json:"delivery_method"`
	Status          string     `json:"status"`
	ExpiresAt       time.Time  `json:"expires_at"`
	UsedAt          *time.Time `json:"used_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

type TenantDocument struct {
	ID           uuid.UUID `json:"id"`
	FileID       uuid.UUID `json:"file_id"`
	DocumentType string    `json:"document_type"`
	FileName     string    `json:"file_name"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	CreatedAt    time.Time `json:"created_at"`
}
