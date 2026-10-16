package queue

import (
	"context"
	"testing"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"github.com/stretchr/testify/assert"
)

func TestGetRetryCount(t *testing.T) {
	assert.Equal(t, 0, getRetryCount(nil))
	assert.Equal(t, 0, getRetryCount(amqp.Table{}))

	assert.Equal(t, 2, getRetryCount(amqp.Table{"x-retry-count": int32(2)}))
	assert.Equal(t, 3, getRetryCount(amqp.Table{"x-retry-count": int64(3)}))
	assert.Equal(t, 4, getRetryCount(amqp.Table{"x-retry-count": 4}))
}

func TestConsumers_NilConnectionGracefulReturn(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	assert.NoError(t, ConsumeWhatsAppMessages(ctx, nil, nil, nil))
	assert.NoError(t, ConsumeEmailMessages(ctx, nil, nil, nil))
	assert.NoError(t, ConsumeContractPDFJobs(ctx, nil, nil, nil))
	assert.NoError(t, ConsumeReportExportJobs(ctx, nil, nil, nil))
	assert.NoError(t, ConsumeAITriageJobs(ctx, nil, nil, nil))
}
