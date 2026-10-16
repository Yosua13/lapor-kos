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
)

// ConsumeReportExportJobs consumes asynchronous financial CSV/report export jobs.
func ConsumeReportExportJobs(
	ctx context.Context,
	conn *rabbitmq.Connection,
	financeRepo *repository.FinanceRepository,
	storage *service.StorageService,
) error {
	if conn == nil || !conn.IsConnected() {
		return nil
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("open channel for report export consumer: %w", err)
	}
	defer ch.Close()

	if err := ch.Qos(2, 0, false); err != nil {
		return fmt.Errorf("set qos for report export consumer: %w", err)
	}

	msgs, err := ch.ConsumeWithContext(
		ctx,
		"q.document.report_csv",
		"worker.document.report_csv",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("subscribe to q.document.report_csv: %w", err)
	}

	log.Printf("[WORKER] Started Report CSV export consumer on q.document.report_csv")

	for {
		select {
		case <-ctx.Done():
			log.Printf("[WORKER] Shutting down Report CSV export consumer")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[WORKER] Report export message channel closed")
				return nil
			}

			var job rabbitmq.DocumentJob
			if err := json.Unmarshal(msg.Body, &job); err != nil {
				log.Printf("[WORKER] Malformed report export job: %v; sending to DLQ", err)
				_ = msg.Nack(false, false)
				continue
			}

			reportType, _ := job.Payload["report_type"].(string)
			periodStart, _ := job.Payload["period_start"].(string)
			periodEnd, _ := job.Payload["period_end"].(string)
			exportFormat, _ := job.Payload["export_format"].(string)
			if exportFormat == "" {
				exportFormat = "csv"
			}

			req := model.CreateExportJobRequest{
				ReportType:   reportType,
				PeriodStart:  periodStart,
				PeriodEnd:    periodEnd,
				ExportFormat: exportFormat,
			}

			createdJob, err := financeRepo.CreateExportJob(ctx, job.PropertyID, job.RequestedBy, req)
			if err != nil {
				log.Printf("[WORKER] Failed to process export job %s: %v", job.JobID, err)
				retryCount := getRetryCount(msg.Headers)
				if retryCount < maxNotificationRetries {
					_ = msg.Nack(false, true)
				} else {
					_ = msg.Nack(false, false)
				}
				continue
			}

			log.Printf("[WORKER] Successfully processed export job %s (rows: %d, sha: %s)",
				createdJob.ID, createdJob.TotalRows, createdJob.ChecksumSHA256)
			_ = msg.Ack(false)
		}
	}
}
