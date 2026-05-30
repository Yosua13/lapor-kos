package model

import (
	"time"

	"github.com/google/uuid"
)

type Contract struct {
	ID            uuid.UUID  `json:"id"`
	RoomID        *uuid.UUID `json:"room_id"`
	TenantID      *uuid.UUID `json:"tenant_id"`
	OwnerID       uuid.UUID  `json:"owner_id"`
	StartDate      time.Time  `json:"start_date"`
	EndDate        time.Time  `json:"end_date"`
	RentalDuration int        `json:"rental_duration"`
	MonthlyRent    float64    `json:"monthly_rent"`
	TotalPrice     float64    `json:"total_price"`
	Deposit        float64    `json:"deposit"`
	PaymentDueDay  int        `json:"payment_due_day"`
	Status         string     `json:"status"` // active, expired, cancelled
	Notes          string     `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`

	// Nested relation structs for rich response
	Room   *Room   `json:"room,omitempty"`
	Tenant *Tenant `json:"tenant,omitempty"`
}

type CreateContractRequest struct {
	RoomID        string  `json:"room_id" binding:"required"`
	TenantID      string  `json:"tenant_id" binding:"required"`
	StartDate      string  `json:"start_date" binding:"required"`
	EndDate        string  `json:"end_date" binding:"required"`
	RentalDuration int     `json:"rental_duration" binding:"required"`
	MonthlyRent    float64 `json:"monthly_rent" binding:"required"`
	TotalPrice     float64 `json:"total_price"`
	Deposit        float64 `json:"deposit"`
	PaymentDueDay  int     `json:"payment_due_day"`
	Notes          string  `json:"notes"`
}

type UpdateContractRequest struct {
	EndDate       string  `json:"end_date"`
	MonthlyRent   float64 `json:"monthly_rent"`
	Deposit       float64 `json:"deposit"`
	PaymentDueDay int     `json:"payment_due_day"`
	Status        string  `json:"status"`
	Notes         string  `json:"notes"`
}
