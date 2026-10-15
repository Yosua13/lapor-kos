package cron

import (
	"context"
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
)

type DeliveryCron struct {
	repo         *repository.NotificationRepository
	waService    service.WhatsAppServiceInterface
	emailService service.EmailServiceInterface
	stopChan     chan struct{}
}

func NewDeliveryCron(
	repo *repository.NotificationRepository,
	waService service.WhatsAppServiceInterface,
	emailService service.EmailServiceInterface,
) *DeliveryCron {
	return &DeliveryCron{
		repo:         repo,
		waService:    waService,
		emailService: emailService,
		stopChan:     make(chan struct{}),
	}
}

func (c *DeliveryCron) Start() {
	if c.repo == nil || c.repo.DB() == nil {
		return
	}

	// Immediate run on startup
	go c.runBatch(context.Background())

	ticker := time.NewTicker(15 * time.Second)
	go func() {
		for {
			select {
			case <-ticker.C:
				c.runBatch(context.Background())
			case <-c.stopChan:
				ticker.Stop()
				return
			}
		}
	}()
}

func (c *DeliveryCron) Stop() {
	close(c.stopChan)
}

func (c *DeliveryCron) runBatch(ctx context.Context) {
	processed, err := c.repo.ProcessPendingOutbox(ctx, 20, c.waService, c.emailService)
	if err != nil {
		log.Printf("[DELIVERY CRON] process pending outbox error: %v", err)
		return
	}
	if processed > 0 {
		log.Printf("[DELIVERY CRON] processed %d pending notification outbox events", processed)
	}
}

func (c *DeliveryCron) Trigger(ctx context.Context) (int, error) {
	return c.repo.ProcessPendingOutbox(ctx, 50, c.waService, c.emailService)
}
