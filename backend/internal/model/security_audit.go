package model

import (
	"time"

	"github.com/google/uuid"
)

// FinancialAuditLog represents an immutable audit record for critical financial events.
type FinancialAuditLog struct {
	ID            uuid.UUID      `json:"id"`
	PropertyID    uuid.UUID      `json:"property_id"`
	ActorID       *uuid.UUID     `json:"actor_id,omitempty"`
	ActorEmail    string         `json:"actor_email"`
	ActorRole     string         `json:"actor_role"`
	Action        string         `json:"action"`
	EntityType    string         `json:"entity_type"`
	EntityID      uuid.UUID      `json:"entity_id"`
	AmountMinor   int64          `json:"amount_minor"`
	Currency      string         `json:"currency"`
	Reason        string         `json:"reason"`
	CorrelationID string         `json:"correlation_id"`
	IPAddress     string         `json:"ip_address,omitempty"`
	UserAgent     string         `json:"user_agent,omitempty"`
	BeforeState   map[string]any `json:"before_state,omitempty"`
	AfterState    map[string]any `json:"after_state,omitempty"`
	Metadata      map[string]any `json:"metadata,omitempty"`
	CreatedAt     time.Time      `json:"created_at"`
}

// FinancialAuditFilter encapsulates search and pagination parameters for audit logs.
type FinancialAuditFilter struct {
	PropertyID    uuid.UUID  `json:"property_id"`
	EntityType    string     `json:"entity_type,omitempty"`
	Action        string     `json:"action,omitempty"`
	CorrelationID string     `json:"correlation_id,omitempty"`
	ActorID       *uuid.UUID `json:"actor_id,omitempty"`
	StartDate     string     `json:"start_date,omitempty"` // YYYY-MM-DD
	EndDate       string     `json:"end_date,omitempty"`   // YYYY-MM-DD
	Page          int        `json:"page"`
	PageSize      int        `json:"page_size"`
}

// FinancialAuditListResult contains paginated financial audit logs.
type FinancialAuditListResult struct {
	Items      []FinancialAuditLog `json:"items"`
	Total      int64               `json:"total"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"page_size"`
	TotalPages int                 `json:"total_pages"`
}

// SystemHealthStatus reports end-to-end system and dependency health.
type SystemHealthStatus struct {
	Status    string          `json:"status"` // "ready", "degraded", "unhealthy"
	Timestamp time.Time       `json:"timestamp"`
	Database  DatabaseHealth  `json:"database"`
	Storage   StorageHealth   `json:"storage"`
	Runtime   RuntimeHealth   `json:"runtime"`
	Security  SecuritySummary `json:"security"`
}

// DatabaseHealth reports PostgreSQL connection metrics.
type DatabaseHealth struct {
	Status          string  `json:"status"` // "connected", "error"
	LatencyMs       float64 `json:"latency_ms"`
	TotalConns      int32   `json:"total_conns"`
	IdleConns       int32   `json:"idle_conns"`
	AcquiredConns   int32   `json:"acquired_conns"`
	MaxConns        int32   `json:"max_conns"`
	LatestMigration string  `json:"latest_migration"`
}

// StorageHealth reports file storage configuration status.
type StorageHealth struct {
	Configured       bool   `json:"configured"`
	MainBucket       string `json:"main_bucket"`
	TenantDocBucket  string `json:"tenant_doc_bucket"`
	PrivateNamespace bool   `json:"private_namespace_enforced"`
}

// RuntimeHealth reports Go runtime indicators.
type RuntimeHealth struct {
	Goroutines    int    `json:"goroutines"`
	UptimeSeconds int64  `json:"uptime_seconds"`
	Environment   string `json:"environment"`
	Version       string `json:"version"`
}

// SecuritySummary gives a high-level overview of active security controls.
type SecuritySummary struct {
	CORSEnforced        bool `json:"cors_enforced"`
	SecurityHeaders     bool `json:"security_headers"`
	RateLimitingActive  bool `json:"rate_limiting_active"`
	SessionRevocationOK bool `json:"session_revocation_ok"`
	AuditLoggingActive  bool `json:"audit_logging_active"`
}

// SecurityChecklist represents the compliance status of release gates.
type SecurityChecklist struct {
	SecretScanningPass        bool      `json:"secret_scanning_pass"`
	MigrationsInOrder         bool      `json:"migrations_in_order"`
	PrivateFilesEnforced      bool      `json:"private_files_enforced"`
	MultiTenantIsolationPass  bool      `json:"multi_tenant_isolation_pass"`
	RestoreDrillPass          bool      `json:"restore_drill_pass"`
	ReleaseArtifactsPass      bool      `json:"release_artifacts_pass"`
	LastAuditedAt             time.Time `json:"last_audited_at"`
	ActiveFinancialAuditCount int64     `json:"active_financial_audit_count"`
}

// RevokeSessionRequest is the payload to invalidate active sessions.
type RevokeSessionRequest struct {
	UserID uuid.UUID `json:"user_id" binding:"required"`
	Reason string    `json:"reason" binding:"required"`
}
