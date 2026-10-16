package redis

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AcquireDistributedLock attempts to acquire a distributed lock using Redis SETNX with a TTL.
// lockKey: identifier for the critical section (e.g. "billing:2026-10")
// val: unique token for the lock owner (e.g. instance ID or UUID)
// ttl: maximum lease time before lock auto-expires to prevent deadlocks
// Returns (acquired, error). If Redis is disabled/nil, it returns (true, nil) for single-instance fallback.
func AcquireDistributedLock(ctx context.Context, client *Client, lockKey string, val string, ttl time.Duration) (bool, error) {
	if client == nil || !client.IsEnabled() || client.Raw() == nil {
		// Single-instance fallback when Redis is unconfigured
		return true, nil
	}

	key := lockKey
	if !strings.HasPrefix(key, "lock:") {
		key = "lock:" + key
	}

	if val == "" {
		val = uuid.NewString()
	}

	if ttl <= 0 {
		ttl = 5 * time.Minute
	}

	return client.Raw().SetNX(ctx, key, val, ttl).Result()
}

// AcquireDistributedLock is a convenience method on *Client.
func (c *Client) AcquireDistributedLock(ctx context.Context, lockKey string, val string, ttl time.Duration) (bool, error) {
	return AcquireDistributedLock(ctx, c, lockKey, val, ttl)
}
