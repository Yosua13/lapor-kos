package model

import (
	"time"

	"github.com/google/uuid"
)

type VisitorPermitStatus string

const (
	VisitorPermitStatusPending         VisitorPermitStatus = "pending"
	VisitorPermitStatusApproved        VisitorPermitStatus = "approved"
	VisitorPermitStatusRejected        VisitorPermitStatus = "rejected"
	VisitorPermitStatusChangeRequested VisitorPermitStatus = "change_requested"
	VisitorPermitStatusActive          VisitorPermitStatus = "active"
	VisitorPermitStatusCompleted       VisitorPermitStatus = "completed"
	VisitorPermitStatusCancelled       VisitorPermitStatus = "cancelled"
	VisitorPermitStatusExpired         VisitorPermitStatus = "expired"
)

func (s VisitorPermitStatus) Valid() bool {
	switch s {
	case VisitorPermitStatusPending,
		VisitorPermitStatusApproved,
		VisitorPermitStatusRejected,
		VisitorPermitStatusChangeRequested,
		VisitorPermitStatusActive,
		VisitorPermitStatusCompleted,
		VisitorPermitStatusCancelled,
		VisitorPermitStatusExpired:
		return true
	default:
		return false
	}
}

type VisitorPermitEventType string

const (
	VisitorPermitEventSubmitted       VisitorPermitEventType = "submitted"
	VisitorPermitEventApproved        VisitorPermitEventType = "approved"
	VisitorPermitEventRejected        VisitorPermitEventType = "rejected"
	VisitorPermitEventChangeRequested VisitorPermitEventType = "change_requested"
	VisitorPermitEventCheckedIn       VisitorPermitEventType = "checked_in"
	VisitorPermitEventCheckedOut      VisitorPermitEventType = "checked_out"
	VisitorPermitEventCancelled       VisitorPermitEventType = "cancelled"
	VisitorPermitEventAnonymized      VisitorPermitEventType = "anonymized"
)

type VisitorPermit struct {
	ID               uuid.UUID           `json:"id" db:"id"`
	PropertyID       uuid.UUID           `json:"property_id" db:"property_id"`
	TenantID         uuid.UUID           `json:"tenant_id" db:"tenant_id"`
	ContractID       uuid.UUID           `json:"contract_id" db:"contract_id"`
	RoomID           uuid.UUID           `json:"room_id" db:"room_id"`
	GuestName        string              `json:"guest_name" db:"guest_name"`
	GuestPhone       *string             `json:"guest_phone,omitempty" db:"guest_phone"`
	GuestIDCardLast4 *string             `json:"guest_id_card_last4,omitempty" db:"guest_id_card_last4"`
	Relationship     string              `json:"relationship" db:"relationship"`
	Purpose          string              `json:"purpose" db:"purpose"`
	IsOvernight      bool                `json:"is_overnight" db:"is_overnight"`
	StartTime        time.Time           `json:"start_time" db:"start_time"`
	EndTime          time.Time           `json:"end_time" db:"end_time"`
	TotalGuests      int                 `json:"total_guests" db:"total_guests"`
	VehicleType      string              `json:"vehicle_type" db:"vehicle_type"`
	VehicleNumber    *string             `json:"vehicle_number,omitempty" db:"vehicle_number"`
	Status           VisitorPermitStatus `json:"status" db:"status"`
	PassToken        *string             `json:"pass_token,omitempty" db:"pass_token"`
	ReviewedBy       *uuid.UUID          `json:"reviewed_by,omitempty" db:"reviewed_by"`
	ReviewedAt       *time.Time          `json:"reviewed_at,omitempty" db:"reviewed_at"`
	ReviewNotes      *string             `json:"review_notes,omitempty" db:"review_notes"`
	CheckedInBy      *uuid.UUID          `json:"checked_in_by,omitempty" db:"checked_in_by"`
	CheckedInAt      *time.Time          `json:"checked_in_at,omitempty" db:"checked_in_at"`
	CheckedOutBy     *uuid.UUID          `json:"checked_out_by,omitempty" db:"checked_out_by"`
	CheckedOutAt     *time.Time          `json:"checked_out_at,omitempty" db:"checked_out_at"`
	IsAnonymized     bool                `json:"is_anonymized" db:"is_anonymized"`
	AnonymizedAt     *time.Time          `json:"anonymized_at,omitempty" db:"anonymized_at"`
	CreatedAt        time.Time           `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time           `json:"updated_at" db:"updated_at"`

	// Derived / joined fields
	TenantName   string `json:"tenant_name,omitempty" db:"tenant_name"`
	TenantPhone  string `json:"tenant_phone,omitempty" db:"tenant_phone"`
	RoomNumber   string `json:"room_number,omitempty" db:"room_number"`
	PropertyName string `json:"property_name,omitempty" db:"property_name"`
	IsOverstay   bool   `json:"is_overstay"`
}

type VisitorPermitEvent struct {
	ID              uuid.UUID              `json:"id" db:"id"`
	VisitorPermitID uuid.UUID              `json:"visitor_permit_id" db:"visitor_permit_id"`
	PropertyID      uuid.UUID              `json:"property_id" db:"property_id"`
	ActorID         *uuid.UUID             `json:"actor_id,omitempty" db:"actor_id"`
	ActorRole       string                 `json:"actor_role" db:"actor_role"`
	EventType       VisitorPermitEventType `json:"event_type" db:"event_type"`
	Reason          *string                `json:"reason,omitempty" db:"reason"`
	Payload         map[string]any         `json:"payload" db:"payload"`
	CreatedAt       time.Time              `json:"created_at" db:"created_at"`

	ActorName string `json:"actor_name,omitempty" db:"actor_name"`
}

type CreateVisitorPermitRequest struct {
	GuestName        string `json:"guest_name" binding:"required"`
	GuestPhone       string `json:"guest_phone"`
	GuestIDCardLast4 string `json:"guest_id_card_last4"`
	Relationship     string `json:"relationship" binding:"required"`
	Purpose          string `json:"purpose" binding:"required"`
	IsOvernight      bool   `json:"is_overnight"`
	StartTime        string `json:"start_time" binding:"required"`
	EndTime          string `json:"end_time" binding:"required"`
	TotalGuests      int    `json:"total_guests"`
	VehicleType      string `json:"vehicle_type"`
	VehicleNumber    string `json:"vehicle_number"`
}

type ReviewVisitorPermitRequest struct {
	Reason string `json:"reason"`
}

type CancelVisitorPermitRequest struct {
	Reason string `json:"reason"`
}

type ApplyRetentionRequest struct {
	OlderThanDays int `json:"older_than_days"`
}

type VisitorPermitFilter struct {
	PropertyID  uuid.UUID
	TenantID    *uuid.UUID
	Status      string
	StartDate   *time.Time
	EndDate     *time.Time
	IsOvernight *bool
	Search      string
	Limit       int
	Offset      int
}

type VisitorPassVerification struct {
	PassToken       string     `json:"pass_token"`
	PropertyName    string     `json:"property_name"`
	RoomNumber      string     `json:"room_number"`
	GuestNameMasked string     `json:"guest_name_masked"`
	Relationship    string     `json:"relationship"`
	Purpose         string     `json:"purpose"`
	IsOvernight     bool       `json:"is_overnight"`
	StartTime       time.Time  `json:"start_time"`
	EndTime         time.Time  `json:"end_time"`
	TotalGuests     int        `json:"total_guests"`
	VehicleType     string     `json:"vehicle_type"`
	VehicleNumber   *string    `json:"vehicle_number,omitempty"`
	Status          string     `json:"status"`
	IsValid         bool       `json:"is_valid"`
	IsOverstay      bool       `json:"is_overstay"`
	CheckedInAt     *time.Time `json:"checked_in_at,omitempty"`
	CheckedOutAt    *time.Time `json:"checked_out_at,omitempty"`
}

type VisitorPermitSummary struct {
	TotalToday    int `json:"total_today"`
	ActiveCount   int `json:"active_count"`
	PendingCount  int `json:"pending_count"`
	OverstayCount int `json:"overstay_count"`
	RejectedCount int `json:"rejected_count"`
}
