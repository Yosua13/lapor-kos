package redis

import (
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client wraps *redis.Client with health telemetry, graceful degradation,
// and thread-safe reconnect tracking.
type Client struct {
	rawClient         *redis.Client
	enabled           bool
	mu                sync.RWMutex
	connected         bool
	connectedSince    *time.Time
	reconnectAttempts int64
}

// Raw returns the underlying *redis.Client for use in caching and locking.
// Returns nil when Redis is disabled.
func (c *Client) Raw() *redis.Client {
	if c == nil {
		return nil
	}
	return c.rawClient
}

// IsEnabled returns true if Redis configuration was provided.
func (c *Client) IsEnabled() bool {
	if c == nil {
		return false
	}
	return c.enabled
}
