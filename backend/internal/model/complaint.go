package model

import (
	"time"

	"github.com/google/uuid"
)

type Complaint struct {
	ID                uuid.UUID  `json:"id"`
	UserID            uuid.UUID  `json:"user_id"`
	OwnerID           uuid.UUID  `json:"owner_id"`
	RoomID            uuid.UUID  `json:"room_id"`
	Title             string     `json:"title"`
	Description       string     `json:"description"`
	Category          string     `json:"category"` // 'noisy', 'facility', 'cleanliness', 'security', 'other'
	Status            string     `json:"status"`   // 'pending', 'processed', 'resolved'
	PhotoURL          *string    `json:"photo_url"`
	AIResponse        *string    `json:"ai_response"`
	WASent            bool       `json:"wa_sent"`
	WAMessage         *string    `json:"wa_message"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	
	// Virtual fields for display
	RoomNumber        string     `json:"room_number,omitempty"`
	UserName          string     `json:"user_name,omitempty"`
}

type CreateComplaintRequest struct {
	Title       string  `json:"title" binding:"required"`
	Description string  `json:"description" binding:"required"`
	Category    string  `json:"category" binding:"required"` // 'noisy', 'facility', 'cleanliness', 'security', 'other'
	PhotoURL    *string `json:"photo_url"`
}

type UpdateComplaintStatusRequest struct {
	Status string `json:"status" binding:"required"` // 'pending', 'processed', 'resolved'
}

type UpdateWhatsAppGroupRequest struct {
	WhatsAppGroupLink string `json:"whatsapp_group_link" binding:"required"`
}
