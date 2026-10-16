package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
)

// ConsumeEmailMessages starts a long-running consumer processing Email notification messages.
// It handles manual ACKs, exponential retry backoff, and DLQ routing.
func ConsumeEmailMessages(
	ctx context.Context,
	conn *rabbitmq.Connection,
	emailService service.EmailServiceInterface,
	notifRepo *repository.NotificationRepository,
) error {
	if conn == nil || !conn.IsConnected() {
		return nil
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for email consumer: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(5, 0, false); err != nil {
		return fmt.Errorf("set qos for email consumer: %w", err)
	}

	msgs, err := ch.ConsumeWithContext(
		ctx,
		"q.notification.email",
		"worker.notification.email",
		false, // manual ack
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("subscribe to q.notification.email: %w", err)
	}

	log.Printf("[WORKER] Started Email notification consumer on q.notification.email")

	for {
		select {
		case <-ctx.Done():
			log.Printf("[WORKER] Shutting down Email notification consumer")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[WORKER] Email message channel closed")
				return nil
			}

			var event rabbitmq.NotificationEvent
			if err := json.Unmarshal(msg.Body, &event); err != nil {
				log.Printf("[WORKER] Email malformed message: %v; sending to DLQ", err)
				_ = msg.Nack(false, false)
				continue
			}

			subject := event.Subject
			if subject == "" {
				subject = "Pemberitahuan Lapor Kos"
			}

			// Attempt delivery
			sendErr := emailService.SendGeneralEmail(event.RecipientEmail, subject, event.Message)
			if sendErr == nil {
				_ = msg.Ack(false)
				log.Printf("[WORKER] Email delivered to %s for event %s (corr: %s)",
					event.RecipientEmail, event.EventType, event.CorrelationID)
				continue
			}

			retryCount := getRetryCount(msg.Headers)
			if retryCount < maxNotificationRetries {
				backoff := time.Duration(1<<retryCount) * 500 * time.Millisecond
				log.Printf("[WORKER] Email send error to %s: %v. Retrying (#%d) in %v",
					event.RecipientEmail, sendErr, retryCount+1, backoff)
				time.Sleep(backoff)
				_ = msg.Nack(false, true)
			} else {
				log.Printf("[WORKER] Email send permanently failed to %s after %d retries: %v; routing to DLQ",
					event.RecipientEmail, maxNotificationRetries, sendErr)
				_ = msg.Nack(false, false)
			}
		}
	}
}
