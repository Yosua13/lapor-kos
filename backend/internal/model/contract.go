package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type Contract struct {
	ID                    uuid.UUID  `json:"id"`
	PropertyID            uuid.UUID  `json:"property_id"`
	RoomID                *uuid.UUID `json:"room_id"`
	UserID                *uuid.UUID `json:"user_id"`
	OwnerID               uuid.UUID  `json:"owner_id"`
	StartDate             time.Time  `json:"start_date"`
	EndDate               time.Time  `json:"end_date"`
	RentalDuration        int        `json:"rental_duration"`
	MonthlyRent           float64    `json:"monthly_rent"`
	TotalPrice            float64    `json:"total_price"`
	ElectricityBill       float64    `json:"electricity_bill"`
	WaterBill             float64    `json:"water_bill"`
	OtherBills            float64    `json:"other_bills"`
	Deposit               float64    `json:"deposit"`
	PaymentInterval       string     `json:"payment_interval"` // 'monthly' or 'per_contract'
	PaymentDueDay         int        `json:"payment_due_day"`
	Status                string     `json:"status"`
	Notes                 string     `json:"notes"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
	CurrentVersionID      *uuid.UUID `json:"current_version_id,omitempty"`
	RenewedFromContractID *uuid.UUID `json:"renewed_from_contract_id,omitempty"`

	// Latest payment status dynamically computed
	LatestPaymentStatus *string  `json:"latest_payment_status,omitempty"`
	LatestPaymentAmount *float64 `json:"latest_payment_amount,omitempty"`

	// Nested relation structs for rich response
	Room *Room `json:"room,omitempty"`
	User *User `json:"user,omitempty"`
}

type CreateContractRequest struct {
	RoomID          string  `json:"room_id" binding:"required"`
	UserID          string  `json:"user_id" binding:"required"`
	StartDate       string  `json:"start_date" binding:"required"`
	EndDate         string  `json:"end_date" binding:"required"`
	RentalDuration  int     `json:"rental_duration" binding:"required"`
	MonthlyRent     float64 `json:"monthly_rent" binding:"required"`
	TotalPrice      float64 `json:"total_price"`
	Deposit         float64 `json:"deposit"`
	PaymentInterval string  `json:"payment_interval"`
	PaymentDueDay   int     `json:"payment_due_day"`
	Notes           string  `json:"notes"`
}

type UpdateContractRequest struct {
	StartDate       string  `json:"start_date"`
	RentalDuration  int     `json:"rental_duration"`
	EndDate         string  `json:"end_date"`
	MonthlyRent     float64 `json:"monthly_rent"`
	Deposit         float64 `json:"deposit"`
	PaymentInterval string  `json:"payment_interval"`
	PaymentDueDay   int     `json:"payment_due_day"`
	Status          string  `json:"status"`
	Notes           string  `json:"notes"`
}

const (
	ContractDraft         = "draft"
	ContractPendingTenant = "pending_tenant"
	ContractScheduled     = "scheduled"
	ContractActive        = "active"
	ContractEnded         = "ended"
	ContractTerminated    = "terminated"
	ContractRenewed       = "renewed"
	ContractCancelled     = "cancelled"
)

type ContractVersion struct {
	ID            uuid.UUID       `json:"id"`
	PropertyID    uuid.UUID       `json:"property_id"`
	ContractID    uuid.UUID       `json:"contract_id"`
	VersionNumber int             `json:"version_number"`
	Snapshot      json.RawMessage `json:"snapshot"`
	Reason        string          `json:"reason"`
	CreatedBy     *uuid.UUID      `json:"created_by,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

type ContractEvent struct {
	ID         uuid.UUID       `json:"id"`
	PropertyID uuid.UUID       `json:"property_id"`
	ContractID uuid.UUID       `json:"contract_id"`
	VersionID  *uuid.UUID      `json:"version_id,omitempty"`
	EventType  string          `json:"event_type"`
	FromStatus string          `json:"from_status,omitempty"`
	ToStatus   string          `json:"to_status,omitempty"`
	Reason     string          `json:"reason"`
	Metadata   json.RawMessage `json:"metadata"`
	ActorID    *uuid.UUID      `json:"actor_id,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

type OccupancyPeriod struct {
	ID         uuid.UUID  `json:"id"`
	PropertyID uuid.UUID  `json:"property_id"`
	ContractID uuid.UUID  `json:"contract_id"`
	RoomID     uuid.UUID  `json:"room_id"`
	UserID     uuid.UUID  `json:"user_id"`
	StartDate  time.Time  `json:"start_date"`
	EndDate    time.Time  `json:"end_date"`
	ClosedAt   *time.Time `json:"closed_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

type ContractDocument struct {
	ID            uuid.UUID  `json:"id"`
	PropertyID    uuid.UUID  `json:"property_id"`
	ContractID    uuid.UUID  `json:"contract_id"`
	VersionID     uuid.UUID  `json:"version_id"`
	VersionNumber int        `json:"version_number"`
	FileName      string     `json:"file_name"`
	MimeType      string     `json:"mime_type"`
	SHA256        string     `json:"sha256"`
	SizeBytes     int64      `json:"size_bytes"`
	PublishedBy   *uuid.UUID `json:"published_by,omitempty"`
	PublishedAt   time.Time  `json:"published_at"`
}

type ContractDetail struct {
	Contract
	Versions  []ContractVersion  `json:"versions"`
	Events    []ContractEvent    `json:"events"`
	Occupancy []OccupancyPeriod  `json:"occupancy_periods"`
	Documents []ContractDocument `json:"documents"`
}

type ContractTransitionRequest struct {
	ToStatus      string `json:"to_status" binding:"required"`
	Reason        string `json:"reason"`
	EffectiveDate string `json:"effective_date"`
}

type ContractAmendRequest struct {
	StartDate       string   `json:"start_date"`
	EndDate         string   `json:"end_date"`
	MonthlyRent     *float64 `json:"monthly_rent"`
	Deposit         *float64 `json:"deposit"`
	PaymentInterval string   `json:"payment_interval"`
	PaymentDueDay   *int     `json:"payment_due_day"`
	Notes           *string  `json:"notes"`
	Reason          string   `json:"reason" binding:"required"`
}

type ContractRenewRequest struct {
	StartDate       string  `json:"start_date" binding:"required"`
	EndDate         string  `json:"end_date" binding:"required"`
	MonthlyRent     float64 `json:"monthly_rent" binding:"required"`
	Deposit         float64 `json:"deposit"`
	PaymentInterval string  `json:"payment_interval"`
	PaymentDueDay   int     `json:"payment_due_day"`
	Notes           string  `json:"notes"`
	Reason          string  `json:"reason" binding:"required"`
}
