package model

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type OutboxStatus string

const (
	OutboxStatusPending           OutboxStatus = "pending"
	OutboxStatusProcessing        OutboxStatus = "processing"
	OutboxStatusDelivered         OutboxStatus = "delivered"
	OutboxStatusFailed            OutboxStatus = "failed"
	OutboxStatusPartiallyDelivered OutboxStatus = "partially_delivered"
	OutboxStatusSkipped          OutboxStatus = "skipped"
	OutboxStatusDeduplicated      OutboxStatus = "deduplicated"
)

type DeliveryChannel string

const (
	ChannelInApp    DeliveryChannel = "in_app"
	ChannelWhatsApp DeliveryChannel = "whatsapp"
	ChannelEmail    DeliveryChannel = "email"
	ChannelPush     DeliveryChannel = "push"
	ChannelAll      DeliveryChannel = "all"
)

type DeliveryStatus string

const (
	DeliveryStatusPending           DeliveryStatus = "pending"
	DeliveryStatusDelivered         DeliveryStatus = "delivered"
	DeliveryStatusFailed            DeliveryStatus = "failed"
	DeliveryStatusSkippedQuietHours DeliveryStatus = "skipped_quiet_hours"
	DeliveryStatusOptedOut          DeliveryStatus = "opted_out"
	DeliveryStatusDeduplicated      DeliveryStatus = "deduplicated"
)

type NotificationCategory string

const (
	NotificationCategoryGeneral      NotificationCategory = "general"
	NotificationCategoryBilling      NotificationCategory = "billing"
	NotificationCategoryOperations   NotificationCategory = "operations"
	NotificationCategoryComplaint    NotificationCategory = "complaint"
	NotificationCategoryContract     NotificationCategory = "contract"
	NotificationCategoryAnnouncement NotificationCategory = "announcement"
	NotificationCategorySecurity     NotificationCategory = "security"
)

// NotificationOutboxItem represents an event waiting for dispatch
type NotificationOutboxItem struct {
	ID             uuid.UUID       `json:"id"`
	PropertyID     uuid.UUID       `json:"property_id"`
	EventType      string          `json:"event_type"`
	AggregateType  string          `json:"aggregate_type"`
	AggregateID    uuid.UUID       `json:"aggregate_id"`
	RecipientID    *uuid.UUID      `json:"recipient_id,omitempty"`
	RecipientPhone *string         `json:"recipient_phone,omitempty"`
	RecipientEmail *string         `json:"recipient_email,omitempty"`
	Channel        string          `json:"channel"`
	DedupKey       *string         `json:"dedup_key,omitempty"`
	Priority       string          `json:"priority"`
	Payload        json.RawMessage `json:"payload"`
	Status         OutboxStatus    `json:"status"`
	RetryCount     int             `json:"retry_count"`
	LastError      *string         `json:"last_error,omitempty"`
	NextRetryAt    *time.Time      `json:"next_retry_at,omitempty"`
	ProviderRef    *string         `json:"provider_ref,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	DeliveredAt    *time.Time      `json:"delivered_at,omitempty"`
	Deliveries     []DeliveryRecord `json:"deliveries,omitempty"`
}

// DeliveryRecord tracks an individual channel delivery attempt
type DeliveryRecord struct {
	ID           uuid.UUID       `json:"id"`
	OutboxID     uuid.UUID       `json:"outbox_id"`
	PropertyID   uuid.UUID       `json:"property_id"`
	Channel      DeliveryChannel `json:"channel"`
	Recipient    string          `json:"recipient"`
	Status       DeliveryStatus  `json:"status"`
	ProviderRef  *string         `json:"provider_ref,omitempty"`
	ErrorMessage *string         `json:"error_message,omitempty"`
	RetryCount   int             `json:"retry_count"`
	NextRetryAt  *time.Time      `json:"next_retry_at,omitempty"`
	DeliveredAt  *time.Time      `json:"delivered_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// InAppNotification represents an inbox item for a specific user
type InAppNotification struct {
	ID         uuid.UUID            `json:"id"`
	PropertyID *uuid.UUID           `json:"property_id,omitempty"`
	UserID     uuid.UUID            `json:"user_id"`
	OutboxID   *uuid.UUID           `json:"outbox_id,omitempty"`
	Category   NotificationCategory `json:"category"`
	Title      string               `json:"title"`
	Message    string               `json:"message"`
	ActionURL  *string              `json:"action_url,omitempty"`
	Metadata   json.RawMessage      `json:"metadata"`
	IsRead     bool                 `json:"is_read"`
	ReadAt     *time.Time           `json:"read_at,omitempty"`
	CreatedAt  time.Time            `json:"created_at"`
	DeletedAt  *time.Time           `json:"deleted_at,omitempty"`
}

// NotificationPreference stores user preferences, quiet hours, and opt-outs
type NotificationPreference struct {
	ID                 uuid.UUID  `json:"id"`
	UserID             uuid.UUID  `json:"user_id"`
	PropertyID         *uuid.UUID `json:"property_id,omitempty"`
	EmailEnabled       bool       `json:"email_enabled"`
	WhatsAppEnabled    bool       `json:"whatsapp_enabled"`
	InAppEnabled       bool       `json:"in_app_enabled"`
	QuietHoursEnabled  bool       `json:"quiet_hours_enabled"`
	QuietHoursStart    string     `json:"quiet_hours_start"`    // HH:mm format, e.g. "22:00"
	QuietHoursEnd      string     `json:"quiet_hours_end"`      // HH:mm format, e.g. "07:00"
	QuietHoursTimezone string     `json:"quiet_hours_timezone"` // e.g. "Asia/Jakarta"
	OptOutCategories   []string   `json:"opt_out_categories"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// UpdatePreferencesRequest holds the request to update preferences
type UpdatePreferencesRequest struct {
	EmailEnabled       *bool    `json:"email_enabled"`
	WhatsAppEnabled    *bool    `json:"whatsapp_enabled"`
	InAppEnabled       *bool    `json:"in_app_enabled"`
	QuietHoursEnabled  *bool    `json:"quiet_hours_enabled"`
	QuietHoursStart    *string  `json:"quiet_hours_start"`
	QuietHoursEnd      *string  `json:"quiet_hours_end"`
	QuietHoursTimezone *string  `json:"quiet_hours_timezone"`
	OptOutCategories   []string `json:"opt_out_categories"`
}

// InAppNotificationListResponse is the paginated inbox response
type InAppNotificationListResponse struct {
	Notifications []InAppNotification `json:"notifications"`
	TotalCount    int                 `json:"total_count"`
	UnreadCount   int                 `json:"unread_count"`
}

// OutboxListResponse is the paginated delivery monitor response for staff/owner
type OutboxListResponse struct {
	Items      []NotificationOutboxItem `json:"items"`
	TotalCount int                      `json:"total_count"`
}
