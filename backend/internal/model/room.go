package model

import (
	"time"

	"github.com/google/uuid"
)

type Room struct {
	ID            uuid.UUID `json:"id"`
	RoomNumber    string    `json:"room_number"`
	PricePerMonth float64   `json:"price_per_month"`
	Description   string    `json:"description"`
	Status        string    `json:"status"` // available, occupied
	CreatedAt     time.Time `json:"created_at"`
}

type CreateRoomRequest struct {
	RoomNumber    string  `json:"room_number" binding:"required"`
	PricePerMonth float64 `json:"price_per_month" binding:"required"`
	Description   string  `json:"description"`
	Status        string  `json:"status"`
}
