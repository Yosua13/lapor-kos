package rabbitmq_test

import (
	"context"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPublishers_DisabledConnection(t *testing.T) {
	conn, err := rabbitmq.NewConnection(config.RabbitMQConfig{URL: ""})
	require.NoError(t, err)
	defer conn.Close()

	ctx := context.Background()

	// 1. Notification Event
	notifEvent := &rabbitmq.NotificationEvent{
		OutboxID:       uuid.New(),
		PropertyID:     uuid.New(),
		Channel:        "whatsapp",
		EventType:      "invoice.issued",
		RecipientPhone: "+628123456789",
		Message:        "Invoice #123 is ready",
		Timestamp:      time.Now(),
	}
	err = rabbitmq.PublishNotificationEvent(ctx, conn, notifEvent)
	assert.NoError(t, err, "disabled connection should return nil error")

	// 2. Document Job
	docJob := &rabbitmq.DocumentJob{
		JobID:       uuid.New(),
		PropertyID:  uuid.New(),
		Type:        "contract_pdf",
		RequestedBy: uuid.New(),
	}
	err = rabbitmq.PublishDocumentJob(ctx, conn, docJob)
	assert.NoError(t, err)

	// 3. AI Triage Job
	aiJob := &rabbitmq.AITriageJob{
		ComplaintID: uuid.New(),
		PropertyID:  uuid.New(),
		Title:       "AC Bocor",
		Description: "AC di kamar 101 meneteskan air deras",
		Category:    "facilities",
	}
	err = rabbitmq.PublishAITriageJob(ctx, conn, aiJob)
	assert.NoError(t, err)

	// 4. Test nil connections
	assert.NoError(t, rabbitmq.PublishNotificationEvent(ctx, nil, notifEvent))
	assert.NoError(t, rabbitmq.PublishDocumentJob(ctx, nil, docJob))
	assert.NoError(t, rabbitmq.PublishAITriageJob(ctx, nil, aiJob))
}
