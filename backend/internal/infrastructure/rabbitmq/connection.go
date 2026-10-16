package rabbitmq

import (
	"sync"
	"time"

	"github.com/rabbitmq/amqp091-go"
)

// Connection wraps *amqp091.Connection with thread-safe reconnect management,
// health telemetry, and channel generation.
type Connection struct {
	url               string
	enabled           bool
	rawConn           *amqp091.Connection
	mu                sync.RWMutex
	connected         bool
	connectedSince    *time.Time
	reconnectAttempts int64
	closing           bool
	closeChan         chan struct{}
}

// Raw returns the underlying *amqp091.Connection. Returns nil when disabled.
func (c *Connection) Raw() *amqp091.Connection {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.rawConn
}

// IsEnabled reports whether RabbitMQ was configured in the environment.
func (c *Connection) IsEnabled() bool {
	if c == nil {
		return false
	}
	return c.enabled
}

// IsConnected reports whether the connection is currently alive and ready.
func (c *Connection) IsConnected() bool {
	if c == nil || !c.enabled {
		return false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected && c.rawConn != nil && !c.rawConn.IsClosed()
}
