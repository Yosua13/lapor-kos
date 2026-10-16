package redis

import (
	"context"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDistributedLock(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	lockKey := "cron:billing:2026-10"
	tokenA := "worker-instance-A"
	tokenB := "worker-instance-B"
	ttl := 10 * time.Second

	// 1. Worker A acquires lock
	acquiredA, err := AcquireDistributedLock(ctx, client, lockKey, tokenA, ttl)
	require.NoError(t, err)
	assert.True(t, acquiredA, "worker A should acquire lock")

	// 2. Worker B attempts to acquire same lock -> should be rejected
	acquiredB, err := AcquireDistributedLock(ctx, client, lockKey, tokenB, ttl)
	require.NoError(t, err)
	assert.False(t, acquiredB, "worker B should be rejected while worker A holds lock")

	// 3. Worker B attempts to release lock with its own token -> should not delete lock
	err = ReleaseDistributedLock(ctx, client, lockKey, tokenB)
	require.NoError(t, err)

	// Worker B still cannot acquire lock because A's lock was not deleted
	acquiredB2, err := AcquireDistributedLock(ctx, client, lockKey, tokenB, ttl)
	require.NoError(t, err)
	assert.False(t, acquiredB2, "worker B still cannot acquire lock")

	// 4. Worker A releases lock with correct token
	err = ReleaseDistributedLock(ctx, client, lockKey, tokenA)
	require.NoError(t, err)

	// 5. Worker B now successfully acquires lock
	acquiredB3, err := AcquireDistributedLock(ctx, client, lockKey, tokenB, ttl)
	require.NoError(t, err)
	assert.True(t, acquiredB3, "worker B should now successfully acquire lock")

	// 6. Test convenience method on *Client
	err = client.ReleaseDistributedLock(ctx, lockKey, tokenB)
	require.NoError(t, err)

	acquiredMethod, err := client.AcquireDistributedLock(ctx, lockKey, "worker-C", ttl)
	require.NoError(t, err)
	assert.True(t, acquiredMethod)

	// 7. Test nil client fallback (single-instance safe)
	acquiredNil, err := AcquireDistributedLock(ctx, nil, lockKey, "token", ttl)
	require.NoError(t, err)
	assert.True(t, acquiredNil)

	err = ReleaseDistributedLock(ctx, nil, lockKey, "token")
	assert.NoError(t, err)
}
