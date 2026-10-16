package cron

import (
	"context"
	"log"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
)

type DeliveryCron struct {
	repo         *repository.NotificationRepository
	waService    service.WhatsAppServiceInterface
	emailService service.EmailServiceInterface
	rabbitConn   *rabbitmq.Connection
	stopChan     chan struct{}
}

func NewDeliveryCron(
	repo *repository.NotificationRepository,
	waService service.WhatsAppServiceInterface,
	emailService service.EmailServiceInterface,
	rabbitConn ...*rabbitmq.Connection,
) *DeliveryCron {
	var conn *rabbitmq.Connection
	if len(rabbitConn) > 0 {
		conn = rabbitConn[0]
	}
	return &DeliveryCron{
		repo:         repo,
		waService:    waService,
		emailService: emailService,
		rabbitConn:   conn,
		stopChan:     make(chan struct{}),
	}
}

// WithRabbitMQ configures optional RabbitMQ broker connection.
func (c *DeliveryCron) WithRabbitMQ(conn *rabbitmq.Connection) *DeliveryCron {
	c.rabbitConn = conn
	return c
}

// Start initiates delivery operations. Periodic 15-second database polling
// is eliminated in favor of asynchronous event-driven messaging via RabbitMQ.
func (c *DeliveryCron) Start() {
	if c.repo == nil || c.repo.DB() == nil {
		return
	}

	if c.rabbitConn != nil && c.rabbitConn.IsConnected() {
		log.Printf("[DELIVERY] Periodic 15-second database polling disabled; RabbitMQ event-driven streaming is active.")
	} else {
		log.Printf("[DELIVERY] RabbitMQ unconfigured or standby; running in event-driven mode (15s polling disabled).")
	}
}

func (c *DeliveryCron) Stop() {
	select {
	case <-c.stopChan:
	default:
		close(c.stopChan)
	}
}

// Trigger allows explicit on-demand outbox processing (used by manual testing and test suites).
func (c *DeliveryCron) Trigger(ctx context.Context) (int, error) {
	return c.repo.ProcessPendingOutbox(ctx, 50, c.waService, c.emailService)
}
