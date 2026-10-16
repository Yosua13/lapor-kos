package model

import (
	"time"

	"github.com/google/uuid"
)

// Legacy HouseRule struct for backward compatibility
type HouseRule struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	PropertyID  uuid.UUID  `json:"property_id" db:"property_id"`
	OwnerID     uuid.UUID  `json:"owner_id" db:"owner_id"`
	Category    string     `json:"category" db:"category" binding:"required"`
	Title       string     `json:"title" db:"title" binding:"required"`
	Description string     `json:"description" db:"description" binding:"required"`
	Details     []string   `json:"details" db:"details" binding:"required,min=1"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty" db:"updated_at"`
}

// Rule status constants
const (
	RuleStatusDraft      = "draft"
	RuleStatusPublished  = "published"
	RuleStatusSuperseded = "superseded"
	RuleStatusArchived   = "archived"
)

// Rule category constants
const (
	RuleCategoryKeamanan   = "keamanan"
	RuleCategoryKebersihan = "kebersihan"
	RuleCategoryFasilitas  = "fasilitas"
	RuleCategoryPembayaran = "pembayaran"
	RuleCategoryKetertiban = "ketertiban"
	RuleCategoryTamu       = "tamu"
	RuleCategoryUmum       = "umum"
)

// Rule severity constants
const (
	RuleSeverityCritical = "critical"
	RuleSeverityMajor    = "major"
	RuleSeverityStandard = "standard"
	RuleSeverityMinor    = "minor"
)

// RuleSet represents the container of rules for a property
type RuleSet struct {
	ID          uuid.UUID  `json:"id"`
	PropertyID  uuid.UUID  `json:"property_id"`
	Title       string     `json:"title"`
	Description *string    `json:"description,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// RuleVersion represents a versioned snapshot of house rules
type RuleVersion struct {
	ID              uuid.UUID   `json:"id"`
	RuleSetID       uuid.UUID   `json:"rule_set_id"`
	PropertyID      uuid.UUID   `json:"property_id"`
	VersionNumber   int         `json:"version_number"`
	Status          string      `json:"status"` // draft, published, superseded, archived
	EffectiveFrom   *time.Time  `json:"effective_from,omitempty"`
	ChangeSummary   *string     `json:"change_summary,omitempty"`
	PublishedBy     *uuid.UUID  `json:"published_by,omitempty"`
	PublishedByName *string     `json:"published_by_name,omitempty"`
	PublishedAt     *time.Time  `json:"published_at,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
	Items           []RuleItem  `json:"items"`
	TotalItems      int         `json:"total_items"`
	Acknowledged    *bool       `json:"acknowledged,omitempty"` // For tenant views
	AcknowledgedAt  *time.Time  `json:"acknowledged_at,omitempty"`
}

// RuleItem represents an individual rule item within a version
type RuleItem struct {
	ID                 uuid.UUID `json:"id"`
	RuleVersionID      uuid.UUID `json:"rule_version_id"`
	Category           string    `json:"category"`
	Title              string    `json:"title"`
	Description        string    `json:"description"`
	Details            []string  `json:"details"`
	Severity           string    `json:"severity"`
	OrderIndex         int       `json:"order_index"`
	PenaltyDescription *string   `json:"penalty_description,omitempty"`
	CreatedAt          time.Time `json:"created_at"`
}

// RuleAcknowledgment represents a tenant's recorded acceptance of a rule version
type RuleAcknowledgment struct {
	ID             uuid.UUID  `json:"id"`
	PropertyID     uuid.UUID  `json:"property_id"`
	RuleVersionID  uuid.UUID  `json:"rule_version_id"`
	VersionNumber  int        `json:"version_number"`
	TenantUserID   uuid.UUID  `json:"tenant_user_id"`
	TenantName     string     `json:"tenant_name,omitempty"`
	TenantEmail    string     `json:"tenant_email,omitempty"`
	TenantPhone    string     `json:"tenant_phone,omitempty"`
	RoomNumber     string     `json:"room_number,omitempty"`
	ContractID     *uuid.UUID `json:"contract_id,omitempty"`
	AcknowledgedAt time.Time  `json:"acknowledged_at"`
	SourceIP       string     `json:"source_ip,omitempty"`
	UserAgent      string     `json:"user_agent,omitempty"`
	ConsentText    string     `json:"consent_text"`
	AmendmentNotes *string    `json:"amendment_notes,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// RuleTemplateItem represents predefined rule templates for owner review
type RuleTemplateItem struct {
	Category    string   `json:"category"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Details     []string `json:"details"`
	Severity    string   `json:"severity"`
}

// Request and Response DTOs
type SaveDraftRulesRequest struct {
	Title         string          `json:"title"`
	Description   string          `json:"description"`
	ChangeSummary string          `json:"change_summary"`
	Items         []RuleItemInput `json:"items" binding:"required"`
}

type RuleItemInput struct {
	Category           string   `json:"category" binding:"required"`
	Title              string   `json:"title" binding:"required"`
	Description        string   `json:"description" binding:"required"`
	Details            []string `json:"details"`
	Severity           string   `json:"severity"`
	OrderIndex         int      `json:"order_index"`
	PenaltyDescription string   `json:"penalty_description"`
}

type PublishRuleVersionRequest struct {
	EffectiveFrom *time.Time `json:"effective_from"`
	ChangeSummary string     `json:"change_summary"`
}

type AcknowledgeRuleRequest struct {
	RuleVersionID uuid.UUID  `json:"rule_version_id" binding:"required"`
	ContractID    *uuid.UUID `json:"contract_id"`
	ConsentText   string     `json:"consent_text" binding:"required"`
}

type ActiveRulesResponse struct {
	RuleSet           *RuleSet            `json:"rule_set,omitempty"`
	Version           *RuleVersion        `json:"version,omitempty"`
	Acknowledged      bool                `json:"acknowledged"`
	Acknowledgment    *RuleAcknowledgment `json:"acknowledgment,omitempty"`
	PendingNewVersion bool                `json:"pending_new_version"`
}
