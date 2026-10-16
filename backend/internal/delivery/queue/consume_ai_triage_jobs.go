package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
)

// ConsumeAITriageJobs processes complaint analysis and advisory generation tasks asynchronously.
func ConsumeAITriageJobs(
	ctx context.Context,
	conn *rabbitmq.Connection,
	aiService service.AIServiceInterface,
	complaintRepo *repository.ComplaintRepository,
) error {
	if conn == nil || !conn.IsConnected() {
		return nil
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for ai triage consumer: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(5, 0, false); err != nil {
		return fmt.Errorf("set qos for ai triage consumer: %w", err)
	}

	msgs, err := ch.ConsumeWithContext(
		ctx,
		"q.ai.complaint_triage",
		"worker.ai.complaint_triage",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("subscribe to q.ai.complaint_triage: %w", err)
	}

	log.Printf("[WORKER] Started Gemini AI triage consumer on q.ai.complaint_triage")

	for {
		select {
		case <-ctx.Done():
			log.Printf("[WORKER] Shutting down AI triage consumer")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[WORKER] AI triage message channel closed")
				return nil
			}

			var job rabbitmq.AITriageJob
			if err := json.Unmarshal(msg.Body, &job); err != nil {
				log.Printf("[WORKER] Malformed AI triage job: %v; sending to DLQ", err)
				_ = msg.Nack(false, false)
				continue
			}

			suggestion, err := aiService.GenerateAdvisory(ctx, job.Category, job.Title, job.Description)
			if err != nil {
				log.Printf("[WORKER] AI advisory generation error for complaint %s: %v", job.ComplaintID, err)
				retryCount := getRetryCount(msg.Headers)
				if retryCount < maxNotificationRetries {
					_ = msg.Nack(false, true)
				} else {
					_ = msg.Nack(false, false)
				}
				continue
			}

			if suggestion != nil && complaintRepo != nil {
				suggestion.ComplaintID = job.ComplaintID
				suggestion.PropertyID = job.PropertyID
				if saveErr := complaintRepo.SaveAISuggestion(ctx, suggestion); saveErr != nil {
					log.Printf("[WORKER] Failed to persist AI suggestion for complaint %s: %v", job.ComplaintID, saveErr)
				} else {
					log.Printf("[WORKER] Successfully triaged complaint %s (category: %s, priority: %s)",
						job.ComplaintID, suggestion.SuggestedCategory, suggestion.SuggestedPriority)
				}
			}

			_ = msg.Ack(false)
		}
	}
}
