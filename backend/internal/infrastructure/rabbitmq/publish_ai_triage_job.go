package rabbitmq

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
)

// AITriageJob represents an asynchronous AI complaint classification and advisory job.
type AITriageJob struct {
	ComplaintID   uuid.UUID `json:"complaint_id"`
	PropertyID    uuid.UUID `json:"property_id"`
	Title         string    `json:"title"`
	Description   string    `json:"description"`
	Category      string    `json:"category"`
	CorrelationID string    `json:"correlation_id,omitempty"`
	Timestamp     time.Time `json:"timestamp"`
}

// PublishAITriageJob publishes a complaint triage request to q.ai.complaint_triage.
func PublishAITriageJob(ctx context.Context, conn *Connection, job *AITriageJob) error {
	if conn == nil || !conn.enabled {
		return nil
	}
	if job == nil {
		return errors.New("ai triage job cannot be nil")
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for ai triage job: %w", err)
	}
	defer ch.Close()

	if job.Timestamp.IsZero() {
		job.Timestamp = time.Now().UTC()
	}

	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal ai triage job: %w", err)
	}

	routingKey := "job.ai.complaint_triage"

	msg := amqp.Publishing{
		ContentType:  "application/json",
		DeliveryMode: amqp.Persistent,
		Timestamp:    job.Timestamp,
		Body:         body,
		Headers: amqp.Table{
			"x-correlation-id": job.CorrelationID,
			"x-retry-count":    int32(0),
		},
	}

	return ch.PublishWithContext(
		ctx,
		"kos.events.topic",
		routingKey,
		false,
		false,
		msg,
	)
}

// PublishAITriageJob is a convenience method on *Connection.
func (c *Connection) PublishAITriageJob(ctx context.Context, job *AITriageJob) error {
	return PublishAITriageJob(ctx, c, job)
}
