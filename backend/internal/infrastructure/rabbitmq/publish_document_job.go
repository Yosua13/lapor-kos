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

// DocumentJob represents an asynchronous document processing task (PDF compilation, CSV export).
type DocumentJob struct {
	JobID         uuid.UUID              `json:"job_id"`
	PropertyID    uuid.UUID              `json:"property_id"`
	Type          string                 `json:"type"` // "contract_pdf" or "report_csv"
	RequestedBy   uuid.UUID              `json:"requested_by"`
	Payload       map[string]interface{} `json:"payload,omitempty"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
}

// PublishDocumentJob dispatches a document compilation or export task to RabbitMQ.
func PublishDocumentJob(ctx context.Context, conn *Connection, job *DocumentJob) error {
	if conn == nil || !conn.enabled {
		return nil
	}
	if job == nil {
		return errors.New("document job cannot be nil")
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for document job publish: %w", err)
	}
	defer ch.Close()

	if job.Timestamp.IsZero() {
		job.Timestamp = time.Now().UTC()
	}

	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("marshal document job: %w", err)
	}

	docType := strings.ToLower(job.Type)
	routingKey := fmt.Sprintf("job.document.%s", docType)

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

// PublishDocumentJob is a convenience method on *Connection.
func (c *Connection) PublishDocumentJob(ctx context.Context, job *DocumentJob) error {
	return PublishDocumentJob(ctx, c, job)
}
