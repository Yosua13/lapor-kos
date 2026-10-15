package model

import (
	"time"

	"github.com/google/uuid"
)

const (
	ComplaintPriorityUrgent = "urgent"
	ComplaintPriorityHigh   = "high"
	ComplaintPriorityMedium = "medium"
	ComplaintPriorityLow    = "low"

	ComplaintImpactEmergency = "emergency"
	ComplaintImpactMajor     = "major"
	ComplaintImpactMinor     = "minor"

	ComplaintStatusPending       = "pending"
	ComplaintStatusInProgress    = "in_progress"
	ComplaintStatusScheduled     = "scheduled"
	ComplaintStatusWaitingVendor = "waiting_vendor"
	ComplaintStatusResolved      = "resolved"
	ComplaintStatusConfirmed     = "confirmed"
	ComplaintStatusReopened      = "reopened"
	ComplaintStatusCancelled     = "cancelled"

	SLAStatusWithinSLA = "within_sla"
	SLAStatusWarning   = "warning"
	SLAStatusBreached  = "breached"

	EventVisibilityPublic   = "public"
	EventVisibilityInternal = "internal"

	WorkOrderStatusDraft      = "draft"
	WorkOrderStatusAssigned   = "assigned"
	WorkOrderStatusScheduled  = "scheduled"
	WorkOrderStatusInProgress = "in_progress"
	WorkOrderStatusCompleted  = "completed"
	WorkOrderStatusCancelled  = "cancelled"
)

// Complaint represents the enhanced ticket model with SLA, triage, and assignment.
type Complaint struct {
	ID                  uuid.UUID  `json:"id"`
	PropertyID          uuid.UUID  `json:"property_id"`
	UserID              uuid.UUID  `json:"user_id"`
	OwnerID             uuid.UUID  `json:"owner_id"`
	RoomID              uuid.UUID  `json:"room_id"`
	Title               string     `json:"title"`
	Description         string     `json:"description"`
	Category            string     `json:"category"` // 'noisy', 'facility', 'cleanliness', 'security', 'other'
	Priority            string     `json:"priority"` // 'urgent', 'high', 'medium', 'low'
	Impact              string     `json:"impact"`   // 'emergency', 'major', 'minor'
	Status              string     `json:"status"`   // 'pending', 'in_progress', 'scheduled', 'waiting_vendor', 'resolved', 'confirmed', 'reopened', 'cancelled'
	AccessWindow        *string    `json:"access_window,omitempty"`
	PreferredContact    *string    `json:"preferred_contact,omitempty"`
	AssignedTo          *uuid.UUID `json:"assigned_to,omitempty"`
	PhotoURL            *string    `json:"photo_url,omitempty"`
	AIResponse          *string    `json:"ai_response,omitempty"`
	WASent              bool       `json:"wa_sent"`
	WAMessage           *string    `json:"wa_message,omitempty"`
	FirstResponseAt     *time.Time `json:"first_response_at,omitempty"`
	ResolvedAt          *time.Time `json:"resolved_at,omitempty"`
	ConfirmedResolvedAt *time.Time `json:"confirmed_resolved_at,omitempty"`
	ReopenedAt          *time.Time `json:"reopened_at,omitempty"`
	FirstResponseDueAt  *time.Time `json:"first_response_due_at,omitempty"`
	ResolutionDueAt     *time.Time `json:"resolution_due_at,omitempty"`
	SLAStatus           string     `json:"sla_status"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`

	// Virtual fields for display
	RoomNumber       string `json:"room_number,omitempty"`
	UserName         string `json:"user_name,omitempty"`
	AssigneeName     string `json:"assignee_name,omitempty"`
	WorkOrdersCount  int    `json:"work_orders_count,omitempty"`
	HasAISuggestion  bool   `json:"has_ai_suggestion,omitempty"`
}

// ComplaintEvent represents an append-only timeline entry.
type ComplaintEvent struct {
	ID          uuid.UUID              `json:"id"`
	ComplaintID uuid.UUID              `json:"complaint_id"`
	PropertyID  uuid.UUID              `json:"property_id"`
	ActorID     *uuid.UUID             `json:"actor_id,omitempty"`
	ActorName   string                 `json:"actor_name"`
	ActorRole   string                 `json:"actor_role"`
	EventType   string                 `json:"event_type"`
	Visibility  string                 `json:"visibility"` // 'public', 'internal'
	Message     string                 `json:"message"`
	Payload     map[string]interface{} `json:"payload"`
	CreatedAt   time.Time              `json:"created_at"`
}

// Vendor represents a service contractor.
type Vendor struct {
	ID          uuid.UUID `json:"id"`
	PropertyID  uuid.UUID `json:"property_id"`
	Name        string    `json:"name"`
	ServiceType string    `json:"service_type"` // 'plumbing', 'electrical', 'ac', 'cleaning', 'carpentry', 'general', 'other'
	Phone       *string   `json:"phone,omitempty"`
	Email       *string   `json:"email,omitempty"`
	Address     *string   `json:"address,omitempty"`
	Notes       *string   `json:"notes,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// WorkOrder represents a maintenance task assigned to a vendor.
type WorkOrder struct {
	ID            uuid.UUID  `json:"id"`
	ComplaintID   uuid.UUID  `json:"complaint_id"`
	PropertyID    uuid.UUID  `json:"property_id"`
	VendorID      *uuid.UUID `json:"vendor_id,omitempty"`
	VendorName    *string    `json:"vendor_name,omitempty"`
	VendorPhone   *string    `json:"vendor_phone,omitempty"`
	Title         string     `json:"title"`
	Description   *string    `json:"description,omitempty"`
	Status        string     `json:"status"` // 'draft', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled'
	ScheduledDate *time.Time `json:"scheduled_date,omitempty"`
	EstimatedCost float64    `json:"estimated_cost"`
	ActualCost    float64    `json:"actual_cost"`
	InvoiceURL    *string    `json:"invoice_url,omitempty"`
	Notes         *string    `json:"notes,omitempty"`
	CreatedBy     *uuid.UUID `json:"created_by,omitempty"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// AISuggestion represents an AI recommendation with human override tracking.
type AISuggestion struct {
	ID                uuid.UUID  `json:"id"`
	ComplaintID       uuid.UUID  `json:"complaint_id"`
	PropertyID        uuid.UUID  `json:"property_id"`
	SuggestedCategory string     `json:"suggested_category"`
	SuggestedPriority string     `json:"suggested_priority"`
	SuggestedImpact   string     `json:"suggested_impact"`
	Summary           string     `json:"summary"`
	DraftResponse     string     `json:"draft_response"`
	RecommendedAction string     `json:"recommended_action"`
	ConfidenceScore   float64    `json:"confidence_score"`
	ModelVersion      string     `json:"model_version"`
	IsApplied         bool       `json:"is_applied"`
	AppliedBy         *uuid.UUID `json:"applied_by,omitempty"`
	AppliedAt         *time.Time `json:"applied_at,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}

// Request and Response DTOs

type CreateComplaintRequest struct {
	Title            string  `json:"title" binding:"required"`
	Description      string  `json:"description" binding:"required"`
	Category         string  `json:"category" binding:"required"` // 'noisy', 'facility', 'cleanliness', 'security', 'other'
	Priority         *string `json:"priority"`                    // default 'medium'
	Impact           *string `json:"impact"`                      // default 'minor'
	AccessWindow     *string `json:"access_window"`
	PreferredContact *string `json:"preferred_contact"`
	PhotoURL         *string `json:"photo_url"`
}

type TriageComplaintRequest struct {
	Priority           string     `json:"priority" binding:"required"` // 'urgent', 'high', 'medium', 'low'
	Impact             string     `json:"impact" binding:"required"`   // 'emergency', 'major', 'minor'
	AccessWindow       *string    `json:"access_window"`
	FirstResponseDueAt *time.Time `json:"first_response_due_at"`
	ResolutionDueAt    *time.Time `json:"resolution_due_at"`
	Reason             *string    `json:"reason"`
}

type AssignComplaintRequest struct {
	AssignedTo *uuid.UUID `json:"assigned_to"`
	Notes      *string    `json:"notes"`
}

type AddComplaintEventRequest struct {
	EventType  string  `json:"event_type" binding:"required"`
	Visibility string  `json:"visibility" binding:"required"` // 'public', 'internal'
	Message    string  `json:"message" binding:"required"`
}

type ConfirmResolutionRequest struct {
	Comment *string `json:"comment"`
}

type ReopenComplaintRequest struct {
	Reason string `json:"reason" binding:"required"`
}

type UpdateComplaintStatusRequest struct {
	Status string  `json:"status" binding:"required"`
	Notes  *string `json:"notes"`
}

type UpdateWhatsAppGroupRequest struct {
	WhatsAppGroupLink string `json:"whatsapp_group_link" binding:"required"`
}

type CreateWorkOrderRequest struct {
	VendorID      *uuid.UUID `json:"vendor_id"`
	Title         string     `json:"title" binding:"required"`
	Description   *string    `json:"description"`
	ScheduledDate *time.Time `json:"scheduled_date"`
	EstimatedCost float64    `json:"estimated_cost"`
	ActualCost    float64    `json:"actual_cost"`
	InvoiceURL    *string    `json:"invoice_url"`
	Notes         *string    `json:"notes"`
}

type UpdateWorkOrderRequest struct {
	VendorID      *uuid.UUID `json:"vendor_id"`
	Title         string     `json:"title" binding:"required"`
	Description   *string    `json:"description"`
	Status        string     `json:"status" binding:"required"`
	ScheduledDate *time.Time `json:"scheduled_date"`
	EstimatedCost float64    `json:"estimated_cost"`
	ActualCost    float64    `json:"actual_cost"`
	InvoiceURL    *string    `json:"invoice_url"`
	Notes         *string    `json:"notes"`
}

type CreateVendorRequest struct {
	Name        string  `json:"name" binding:"required"`
	ServiceType string  `json:"service_type" binding:"required"`
	Phone       *string `json:"phone"`
	Email       *string `json:"email"`
	Address     *string `json:"address"`
	Notes       *string `json:"notes"`
}

type UpdateVendorRequest struct {
	Name        string  `json:"name" binding:"required"`
	ServiceType string  `json:"service_type" binding:"required"`
	Phone       *string `json:"phone"`
	Email       *string `json:"email"`
	Address     *string `json:"address"`
	Notes       *string `json:"notes"`
	IsActive    bool    `json:"is_active"`
}

type ApplyAISuggestionRequest struct {
	ApplyPriority      bool `json:"apply_priority"`
	ApplyCategory      bool `json:"apply_category"`
	ApplyDraftResponse bool `json:"apply_draft_response"`
}

type SLADashboardStats struct {
	TotalComplaints          int            `json:"total_complaints"`
	OpenComplaints           int            `json:"open_complaints"`
	BreachedCount            int            `json:"breached_count"`
	WarningCount             int            `json:"warning_count"`
	AvgFirstResponseMinutes  float64        `json:"avg_first_response_minutes"`
	AvgResolutionMinutes     float64        `json:"avg_resolution_minutes"`
	ComplianceRate           float64        `json:"compliance_rate"`
	PriorityBreakdown        map[string]int `json:"priority_breakdown"`
	StatusBreakdown          map[string]int `json:"status_breakdown"`
	HighPriorityPendingAlert int            `json:"high_priority_pending_alert"`
}

// CalculateDefaultSLADueDates determines default first response and resolution targets
// based on priority and impact.
func CalculateDefaultSLADueDates(now time.Time, priority, impact string) (firstResponseDue, resolutionDue time.Time) {
	if priority == ComplaintPriorityUrgent || impact == ComplaintImpactEmergency {
		return now.Add(1 * time.Hour), now.Add(12 * time.Hour)
	}
	if priority == ComplaintPriorityHigh || impact == ComplaintImpactMajor {
		return now.Add(3 * time.Hour), now.Add(24 * time.Hour)
	}
	if priority == ComplaintPriorityLow {
		return now.Add(24 * time.Hour), now.Add(96 * time.Hour)
	}
	// Default Medium
	return now.Add(6 * time.Hour), now.Add(48 * time.Hour)
}

// EvaluateSLAStatus determines if a complaint is within SLA, nearing breach (warning), or breached.
func EvaluateSLAStatus(now time.Time, status string, firstResponseAt, resolvedAt, firstResponseDue, resolutionDue *time.Time) string {
	if status == ComplaintStatusResolved || status == ComplaintStatusConfirmed {
		if resolvedAt != nil && resolutionDue != nil && resolvedAt.After(*resolutionDue) {
			return SLAStatusBreached
		}
		return SLAStatusWithinSLA
	}

	// For open tickets
	if resolutionDue != nil && now.After(*resolutionDue) {
		return SLAStatusBreached
	}
	if firstResponseAt == nil && firstResponseDue != nil && now.After(*firstResponseDue) {
		return SLAStatusBreached
	}

	// Warning condition: within 25% of resolution deadline or past 75% of window
	if resolutionDue != nil {
		timeLeft := resolutionDue.Sub(now)
		if timeLeft <= 4*time.Hour && timeLeft > 0 {
			return SLAStatusWarning
		}
	}

	return SLAStatusWithinSLA
}
