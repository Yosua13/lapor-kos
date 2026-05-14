package model

import (
	"time"

	"github.com/google/uuid"
)

type Tenant struct {
	ID        uuid.UUID  `json:"id"`
	RoomID    *uuid.UUID `json:"room_id"`
	Name      string     `json:"name"`
	Phone     string     `json:"phone"`
	KTPURL    string     `json:"ktp_url"`
	SelfieURL string     `json:"selfie_url"`
	EntryDate time.Time  `json:"entry_date"`
	CreatedAt time.Time  `json:"created_at"`
	Room      *Room      `json:"room,omitempty"`
}

type CreateTenantRequest struct {
	RoomID    string `form:"room_id"`
	Name      string `form:"name" binding:"required"`
	Phone     string `form:"phone"`
	EntryDate string `form:"entry_date"` // Will be parsed to time.Time
}
