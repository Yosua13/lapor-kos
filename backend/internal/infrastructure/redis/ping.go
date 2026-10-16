package redis

import (
	"context"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

// Ping measures Redis ping latency and updates internal health status.
func (c *Client) Ping(ctx context.Context) model.DependencyHealth {
	now := time.Now().UTC()
	if c == nil || !c.enabled || c.rawClient == nil {
		return model.DependencyHealth{
			Status:        model.DependencyStatusDisabled,
			Enabled:       false,
			LastCheckedAt: &now,
		}
	}

	start := time.Now()
	err := c.rawClient.Ping(ctx).Err()
	latencyMs := float64(time.Since(start).Nanoseconds()) / 1e6

	c.mu.Lock()
	defer c.mu.Unlock()

	c.reconnectAttempts++
	if err != nil {
		c.connected = false
		c.connectedSince = nil
		return model.DependencyHealth{
			Status:            model.DependencyStatusDisconnected,
			Enabled:           true,
			LatencyMs:         latencyMs,
			Error:             "connection refused or ping timeout",
			ReconnectAttempts: c.reconnectAttempts,
			LastCheckedAt:     &now,
		}
	}

	if !c.connected {
		c.connected = true
		c.connectedSince = &now
	}

	return model.DependencyHealth{
		Status:            model.DependencyStatusConnected,
		Enabled:           true,
		LatencyMs:         latencyMs,
		ReconnectAttempts: c.reconnectAttempts,
		ConnectedSince:    c.connectedSince,
		LastCheckedAt:     &now,
	}
}
