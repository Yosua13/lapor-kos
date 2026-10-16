package rabbitmq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

// NotificationEvent represents an asynchronous notification message payload.
type NotificationEvent struct {
	OutboxID       uuid.UUID              `json:"outbox_id"`
	PropertyID     uuid.UUID              `json:"property_id"`
	RecipientID    *uuid.UUID             `json:"recipient_id,omitempty"`
	Channel        string                 `json:"channel"` // "whatsapp" or "email"
	EventType      string                 `json:"event_type"`
	RecipientPhone string                 `json:"recipient_phone,omitempty"`
	RecipientEmail string                 `json:"recipient_email,omitempty"`
	Subject        string                 `json:"subject,omitempty"`
	Message        string                 `json:"message,omitempty"`
	Payload        map[string]interface{} `json:"payload,omitempty"`
	CorrelationID  string                 `json:"correlation_id,omitempty"`
	Timestamp      time.Time              `json:"timestamp"`
}

// PublishNotificationEvent publishes a notification event to kos.events.topic.
func PublishNotificationEvent(ctx context.Context, conn *Connection, event *NotificationEvent) error {
	if conn == nil || !conn.enabled {
		return nil
	}
	if event == nil {
		return errors.New("notification event cannot be nil")
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for notification publish: %w", err)
	}
	defer ch.Close()

	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	body, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal notification event: %w", err)
	}

	// Normalize channel for routing key: e.g. "whatsapp" -> "wa"
	channelKey := strings.ToLower(event.Channel)
	if channelKey == "whatsapp" {
		channelKey = "wa"
	}
	routingKey := fmt.Sprintf("event.notification.%s.%s", channelKey, event.EventType)

	msg := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    event.Timestamp,
		Body:         body,
		Headers: amqp.Table{
			"x-correlation-id": event.CorrelationID,
			"x-retry-count":    int32(0),
		},
	}

	return ch.PublishWithContext(
		ctx,
		"kos.events.topic", // exchange
		routingKey,         // routing key
		false,              // mandatory
		false,              // immediate
		msg,
	)
}

// PublishNotificationEvent is a convenience method on *Connection.
func (c *Connection) PublishNotificationEvent(ctx context.Context, event *NotificationEvent) error {
	return PublishNotificationEvent(ctx, c, event)
}
