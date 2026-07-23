package model

import (
	"time"

	"github.com/google/uuid"
)

const (
	DefaultPropertyTimezone = "Asia/Jakarta"
	DefaultPropertyCurrency = "IDR"
)

type PropertyStatus string

const (
	PropertyStatusDraft    PropertyStatus = "draft"
	PropertyStatusActive   PropertyStatus = "active"
	PropertyStatusArchived PropertyStatus = "archived"
)

func (s PropertyStatus) Valid() bool {
	switch s {
	case PropertyStatusDraft, PropertyStatusActive, PropertyStatusArchived:
		return true
	default:
		return false
	}
}

type PropertyRole string

const (
	PropertyRoleOwner       PropertyRole = "property_owner"
	PropertyRoleManager     PropertyRole = "manager"
	PropertyRoleFinance     PropertyRole = "finance"
	PropertyRoleMaintenance PropertyRole = "maintenance"
	PropertyRoleViewer      PropertyRole = "viewer"
)

// RolePropertyOwner and its companions keep call sites readable while the
// PropertyRole-prefixed names remain explicit in serialized domain models.
const (
	RolePropertyOwner = PropertyRoleOwner
	RoleManager       = PropertyRoleManager
	RoleFinance       = PropertyRoleFinance
	RoleMaintenance   = PropertyRoleMaintenance
	RoleViewer        = PropertyRoleViewer
)

func (r PropertyRole) Valid() bool {
	switch r {
	case PropertyRoleOwner, PropertyRoleManager, PropertyRoleFinance, PropertyRoleMaintenance, PropertyRoleViewer:
		return true
	default:
		return false
	}
}

type MembershipStatus string

const (
	MembershipStatusActive    MembershipStatus = "active"
	MembershipStatusSuspended MembershipStatus = "suspended"
	MembershipStatusRevoked   MembershipStatus = "revoked"
)

func (s MembershipStatus) Valid() bool {
	switch s {
	case MembershipStatusActive, MembershipStatusSuspended, MembershipStatusRevoked:
		return true
	default:
		return false
	}
}

type Property struct {
	ID                uuid.UUID      `json:"id" db:"id"`
	Name              string         `json:"name" db:"name"`
	Address           string         `json:"address" db:"address"`
	Timezone          string         `json:"timezone" db:"timezone"`
	Currency          string         `json:"currency" db:"currency"`
	Status            PropertyStatus `json:"status" db:"status"`
	WhatsAppGroupLink *string        `json:"whatsapp_group_link,omitempty" db:"whatsapp_group_link"`
	CreatedBy         uuid.UUID      `json:"created_by" db:"created_by"`
	CreatedAt         time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at" db:"updated_at"`
}

type PropertyMembership struct {
	ID          uuid.UUID        `json:"id" db:"id"`
	PropertyID  uuid.UUID        `json:"property_id" db:"property_id"`
	UserID      uuid.UUID        `json:"user_id" db:"user_id"`
	Role        PropertyRole     `json:"role" db:"role"`
	Permissions []string         `json:"permissions" db:"permissions"`
	Status      MembershipStatus `json:"status" db:"status"`
	CreatedBy   *uuid.UUID       `json:"created_by,omitempty" db:"created_by"`
	CreatedAt   time.Time        `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at" db:"updated_at"`
	RevokedAt   *time.Time       `json:"revoked_at,omitempty" db:"revoked_at"`
}

// PropertyAccess is the flattened response used by the property selector.
// Permissions contains the effective role permissions plus explicit grants.
type PropertyAccess struct {
	ID           uuid.UUID      `json:"id"`
	Name         string         `json:"name"`
	Address      string         `json:"address"`
	Timezone     string         `json:"timezone"`
	Currency     string         `json:"currency"`
	Status       PropertyStatus `json:"status"`
	MembershipID uuid.UUID      `json:"membership_id"`
	Role         PropertyRole   `json:"role"`
	Permissions  []string       `json:"permissions"`
}

type PropertyMember struct {
	PropertyMembership
	Name  string `json:"name"`
	Email string `json:"email"`
}

type PropertyScope struct {
	PropertyID   uuid.UUID    `json:"property_id"`
	ActorID      uuid.UUID    `json:"actor_id"`
	MembershipID uuid.UUID    `json:"membership_id"`
	Role         PropertyRole `json:"role"`
	Permissions  []string     `json:"permissions"`
}

type CreatePropertyRequest struct {
	Name     string `json:"name" binding:"required"`
	Address  string `json:"address"`
	Timezone string `json:"timezone"`
	Currency string `json:"currency"`
}

type UpdatePropertyRequest struct {
	Name              *string         `json:"name"`
	Address           *string         `json:"address"`
	Timezone          *string         `json:"timezone"`
	Currency          *string         `json:"currency"`
	Status            *PropertyStatus `json:"status"`
	WhatsAppGroupLink *string         `json:"whatsapp_group_link"`
}

type AddPropertyMemberRequest struct {
	Email       string       `json:"email" binding:"required,email"`
	Role        PropertyRole `json:"role" binding:"required"`
	Permissions []string     `json:"permissions"`
}

type UpdatePropertyMemberRequest struct {
	Role        *PropertyRole     `json:"role"`
	Status      *MembershipStatus `json:"status"`
	Permissions *[]string         `json:"permissions"`
}
