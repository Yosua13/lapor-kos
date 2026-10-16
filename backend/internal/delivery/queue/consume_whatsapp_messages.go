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
	amqp "github.com/rabbitmq/amqp091-go"
)

const maxNotificationRetries = 3

// ConsumeWhatsAppMessages starts a long-running consumer processing WhatsApp notification messages.
// It handles manual ACKs, exponential retry backoff, and DLQ dead-lettering.
func ConsumeWhatsAppMessages(
	ctx context.Context,
	conn *rabbitmq.Connection,
	waService service.WhatsAppServiceInterface,
	notifRepo *repository.NotificationRepository,
) error {
	if conn == nil || !conn.IsConnected() {
		return nil
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for whatsapp consumer: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(5, 0, false); err != nil {
		return fmt.Errorf("set qos for whatsapp consumer: %w", err)
	}

	msgs, err := ch.ConsumeWithContext(
		ctx,
		"q.notification.whatsapp",
		"worker.notification.whatsapp",
		false, // manual ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		return fmt.Errorf("subscribe to q.notification.whatsapp: %w", err)
	}

	log.Printf("[WORKER] Started WhatsApp notification consumer on q.notification.whatsapp")

	for {
		select {
		case <-ctx.Done():
			log.Printf("[WORKER] Shutting down WhatsApp notification consumer")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[WORKER] WhatsApp message channel closed")
				return nil
			}

			var event rabbitmq.NotificationEvent
			if err := json.Unmarshal(msg.Body, &event); err != nil {
				log.Printf("[WORKER] WhatsApp malformed message: %v; sending to DLQ", err)
				_ = msg.Nack(false, false)
				continue
			}

			// Attempt delivery
			sent, sendErr := waService.SendMessage(ctx, event.RecipientPhone, event.Message)
			if sendErr == nil && sent {
				// Success: ACK
				_ = msg.Ack(false)
				log.Printf("[WORKER] WhatsApp delivered to %s for event %s (corr: %s)",
					event.RecipientPhone, event.EventType, event.CorrelationID)
				continue
			}

			// Delivery failed: check retry count
			retryCount := getRetryCount(msg.Headers)
			if retryCount < maxNotificationRetries {
				backoff := time.Duration(1<<retryCount) * 500 * time.Millisecond
				log.Printf("[WORKER] WhatsApp send error to %s: %v. Retrying (#%d) in %v",
					event.RecipientPhone, sendErr, retryCount+1, backoff)
				time.Sleep(backoff)
				// Requeue with backoff
				_ = msg.Nack(false, true)
			} else {
				log.Printf("[WORKER] WhatsApp send permanently failed to %s after %d retries: %v; routing to DLQ",
					event.RecipientPhone, maxNotificationRetries, sendErr)
				// Reject without requeue -> routes to kos.dlx and q.dead_letter
				_ = msg.Nack(false, false)
			}
		}
	}
}

func getRetryCount(headers amqp.Table) int {
	if headers == nil {
		return 0
	}
	if val, ok := headers["x-retry-count"]; ok {
		switch v := val.(type) {
		case int32:
			return int(v)
		case int64:
			return int(v)
		case int:
			return v
		}
	}
	return 0
}
