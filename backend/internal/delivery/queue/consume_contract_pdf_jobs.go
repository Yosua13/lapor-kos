package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/google/uuid"
)

// ConsumeContractPDFJobs consumes asynchronous contract PDF generation tasks.
func ConsumeContractPDFJobs(
	ctx context.Context,
	conn *rabbitmq.Connection,
	docService *service.ContractDocumentService,
	contractRepo *repository.ContractRepository,
) error {
	if conn == nil || !conn.IsConnected() {
		return nil
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for contract pdf consumer: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(2, 0, false); err != nil {
		return fmt.Errorf("set qos for contract pdf consumer: %w", err)
	}

	msgs, err := ch.ConsumeWithContext(
		ctx,
		"q.document.contract_pdf",
		"worker.document.contract_pdf",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("subscribe to q.document.contract_pdf: %w", err)
	}

	log.Printf("[WORKER] Started Contract PDF compilation consumer on q.document.contract_pdf")

	for {
		select {
		case <-ctx.Done():
			log.Printf("[WORKER] Shutting down Contract PDF consumer")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[WORKER] Contract PDF message channel closed")
				return nil
			}

			var job rabbitmq.DocumentJob
			if err := json.Unmarshal(msg.Body, &job); err != nil {
				log.Printf("[WORKER] Malformed contract PDF job: %v; sending to DLQ", err)
				_ = msg.Nack(false, false)
				continue
			}

			contractIDStr, _ := job.Payload["contract_id"].(string)
			contractID, parseErr := uuid.Parse(contractIDStr)
			if parseErr != nil {
				log.Printf("[WORKER] Invalid contract_id in job payload: %v; sending to DLQ", parseErr)
				_ = msg.Nack(false, false)
				continue
			}

			// Generate contract PDF
			dummyVersion := model.ContractVersion{
				VersionNumber: 1,
				Snapshot:      []byte(`{"title":"Kontrak Sewa Digital"}`),
			}
			if payloadSnapshot, ok := job.Payload["snapshot"].(string); ok && payloadSnapshot != "" {
				dummyVersion.Snapshot = []byte(payloadSnapshot)
			}

			pdfBytes, sha256Hex, genErr := docService.Generate(dummyVersion, model.Contract{ID: contractID})
			if genErr != nil {
				log.Printf("[WORKER] Contract PDF generation failed for contract %s: %v", contractID, genErr)
				retryCount := getRetryCount(msg.Headers)
				if retryCount < maxNotificationRetries {
					_ = msg.Nack(false, true)
				} else {
					_ = msg.Nack(false, false)
				}
				continue
			}

			log.Printf("[WORKER] Contract PDF compiled for %s (%d bytes, sha: %s)", contractID, len(pdfBytes), sha256Hex)
			_ = msg.Ack(false)
		}
	}
}
