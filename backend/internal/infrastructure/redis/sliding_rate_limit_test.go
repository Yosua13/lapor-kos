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

func TestSlidingRateLimit(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	key := "test:rate:user1"
	limit := 3
	window := 2 * time.Second

	// 1. First 3 requests should be allowed
	for i := 1; i <= 3; i++ {
		allowed, err := CheckSlidingRateLimit(ctx, client, key, limit, window)
		require.NoError(t, err)
		assert.True(t, allowed, "request %d should be allowed", i)
	}

	// 2. 4th request should be rejected
	allowed, err := CheckSlidingRateLimit(ctx, client, key, limit, window)
	require.NoError(t, err)
	assert.False(t, allowed, "4th request should be rejected")

	// 3. Fast forward time past the window in miniredis
	s.FastForward(3 * time.Second)

	// 4. Request should now be allowed again
	allowed, err = CheckSlidingRateLimit(ctx, client, key, limit, window)
	require.NoError(t, err)
	assert.True(t, allowed, "request after window expiration should be allowed")

	// 5. Test convenience method on *Client
	allowedMethod, err := client.CheckSlidingRateLimit(ctx, key, limit, window)
	require.NoError(t, err)
	assert.True(t, allowedMethod)

	// 6. Test with nil client
	_, err = CheckSlidingRateLimit(ctx, nil, key, limit, window)
	assert.Error(t, err)
	assert.Equal(t, ErrRedisUnavailable, err)
}
