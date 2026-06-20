package model

import (
	"time"

	"github.com/google/uuid"
)

type HouseRule struct {
	ID          uuid.UUID `json:"id" db:"id"`
	OwnerID     uuid.UUID `json:"owner_id" db:"owner_id"`
	Category    string    `json:"category" db:"category" binding:"required"`
	Title       string    `json:"title" db:"title" binding:"required"`
	Description string    `json:"description" db:"description" binding:"required"`
	Details     []string  `json:"details" db:"details" binding:"required,min=1"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
