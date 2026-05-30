package model

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID             uuid.UUID  `json:"id"`
	RoomID         *uuid.UUID `json:"room_id"`
	Name           string     `json:"name"`
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
	Phone          string `form:"phone"`
	EntryDate      string `form:"entry_date"` // Will be parsed to time.Time
	RentalDuration int    `form:"rental_duration"`
}
