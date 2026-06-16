package model

import (
	"time"

	"github.com/google/uuid"
)

type Contract struct {
	ID            uuid.UUID  `json:"id"`
	RoomID        *uuid.UUID `json:"room_id"`
	UserID        *uuid.UUID `json:"user_id"`
	OwnerID       uuid.UUID  `json:"owner_id"`
	StartDate      time.Time  `json:"start_date"`
	EndDate        time.Time  `json:"end_date"`
	RentalDuration int        `json:"rental_duration"`
	MonthlyRent    float64    `json:"monthly_rent"`
	TotalPrice     float64    `json:"total_price"`
	ElectricityBill float64    `json:"electricity_bill"`
	WaterBill      float64    `json:"water_bill"`
	OtherBills     float64    `json:"other_bills"`
	Deposit        float64    `json:"deposit"`
	PaymentInterval string     `json:"payment_interval"` // 'monthly' or 'per_contract'
	PaymentDueDay  int        `json:"payment_due_day"`
	Status         string     `json:"status"` // active, expired, cancelled
	Notes          string     `json:"notes"`
	CreatedAt      time.Time  `json:"created_at"`

	// Latest payment status dynamically computed
	LatestPaymentStatus *string  `json:"latest_payment_status,omitempty"`
	LatestPaymentAmount *float64 `json:"latest_payment_amount,omitempty"`

	// Nested relation structs for rich response
	Room   *Room   `json:"room,omitempty"`
	User   *User   `json:"user,omitempty"`
}

type CreateContractRequest struct {
	RoomID        string  `json:"room_id" binding:"required"`
	UserID        string  `json:"user_id" binding:"required"`
	StartDate      string  `json:"start_date" binding:"required"`
	EndDate        string  `json:"end_date" binding:"required"`
	RentalDuration int     `json:"rental_duration" binding:"required"`
	MonthlyRent    float64 `json:"monthly_rent" binding:"required"`
	TotalPrice     float64 `json:"total_price"`
	Deposit        float64 `json:"deposit"`
	PaymentInterval string  `json:"payment_interval"`
	PaymentDueDay  int     `json:"payment_due_day"`
	Notes          string  `json:"notes"`
}

type UpdateContractRequest struct {
	StartDate      string  `json:"start_date"`
	RentalDuration int     `json:"rental_duration"`
	EndDate        string  `json:"end_date"`
	MonthlyRent    float64 `json:"monthly_rent"`
	Deposit        float64 `json:"deposit"`
	PaymentInterval string  `json:"payment_interval"`
	PaymentDueDay  int     `json:"payment_due_day"`
	Status         string  `json:"status"`
	Notes          string  `json:"notes"`
}
