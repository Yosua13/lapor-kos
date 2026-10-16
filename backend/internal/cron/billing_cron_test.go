package cron_test

import (
	"context"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/redis"
	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBillingCron_DistributedLock(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := redis.NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	billingCron := cron.NewBillingCron(nil, client)
	require.NotNil(t, billingCron)

	propertyID := uuid.New()
	period := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)

	// Simulate lock already acquired by another worker instance
	lockKey := "billing:property:" + propertyID.String() + ":2026-10"
	acquired, err := redis.AcquireDistributedLock(ctx, client, lockKey, "instance-1", 10*time.Minute)
	require.NoError(t, err)
	assert.True(t, acquired)

	// Another instance attempting TriggerProperty should be rejected due to lock
	_, err = billingCron.TriggerProperty(ctx, propertyID, uuid.New(), period)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "locked by another process")

	// Release the lock
	err = redis.ReleaseDistributedLock(ctx, client, lockKey, "instance-1")
	require.NoError(t, err)

	// Verify lock is freed
	canAcquire, err := redis.AcquireDistributedLock(ctx, client, lockKey, "instance-2", 10*time.Minute)
	require.NoError(t, err)
	assert.True(t, canAcquire)
}
