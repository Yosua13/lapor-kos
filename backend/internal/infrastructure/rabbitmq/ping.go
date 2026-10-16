package rabbitmq

import (
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

// Ping probes the active RabbitMQ connection state and returns health telemetry.
func (c *Connection) Ping() model.DependencyHealth {
	now := time.Now().UTC()
	if c == nil || !c.enabled {
		return model.DependencyHealth{
			Status:        model.DependencyStatusDisabled,
			Enabled:       false,
			LastCheckedAt: &now,
		}
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.rawConn == nil || c.rawConn.IsClosed() {
		return model.DependencyHealth{
			Status:            model.DependencyStatusDisconnected,
			Enabled:           true,
			Error:             "connection closed or broker unreachable",
			ReconnectAttempts: c.reconnectAttempts,
			LastCheckedAt:     &now,
		}
	}

	start := time.Now()
	// Open and immediately close a temporary test channel to measure round-trip latency
	ch, err := c.rawConn.Channel()
	latencyMs := float64(time.Since(start).Nanoseconds()) / 1e6
	if err != nil {
		return model.DependencyHealth{
			Status:            model.DependencyStatusDisconnected,
			Enabled:           true,
			LatencyMs:         latencyMs,
			Error:             err.Error(),
			ReconnectAttempts: c.reconnectAttempts,
			LastCheckedAt:     &now,
		}
	}
	_ = ch.Close()

	return model.DependencyHealth{
		Status:            model.DependencyStatusConnected,
		Enabled:           true,
		LatencyMs:         latencyMs,
		ReconnectAttempts: c.reconnectAttempts,
		ConnectedSince:    c.connectedSince,
		LastCheckedAt:     &now,
	}
}
