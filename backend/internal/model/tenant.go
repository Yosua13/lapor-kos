package model

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID             uuid.UUID  `json:"id"`
	RoomID         *uuid.UUID `json:"room_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty"`
	Name           string     `json:"name"`
	Email          string     `json:"email,omitempty"` // Derived from user table or input
	Phone          string     `json:"phone"`
	KTPURL         string     `json:"ktp_url"`
	SelfieURL      string     `json:"selfie_url"`
	CreatedAt      time.Time  `json:"created_at"`
	Room           *Room      `json:"room,omitempty"`
	Contract       *Contract  `json:"contract,omitempty"`
}

type CreateTenantRequest struct {
	RoomID         string `form:"room_id"`
	Name           string `form:"name" binding:"required"`
	Email          string `form:"email"`
	Phone          string `form:"phone"`
	EntryDate      string `form:"entry_date"` // Will be parsed to time.Time
	RentalDuration int    `form:"rental_duration"`
}
