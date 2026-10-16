package rabbitmq

import (
	"errors"

	"github.com/rabbitmq/amqp091-go"
)

// Channel creates a new AMQP channel from the active connection.
func (c *Connection) Channel() (*amqp091.Channel, error) {
	if c == nil || !c.enabled {
		return nil, errors.New("rabbitmq is disabled")
	}

	c.mu.RLock()
	defer c.mu.RUnlock()

	if c.rawConn == nil || c.rawConn.IsClosed() {
		return nil, errors.New("rabbitmq connection is closed")
	}

	return c.rawConn.Channel()
}
