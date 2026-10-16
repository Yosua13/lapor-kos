package rabbitmq

import (
	"log"
	"time"

	"github.com/rabbitmq/amqp091-go"
)

// startReconnectSupervisor continuously monitors connection state and
// re-establishes broken AMQP connections until Close() is called.
func (c *Connection) startReconnectSupervisor() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-c.closeChan:
			return
		case <-ticker.C:
			c.mu.RLock()
			isClosed := c.rawConn == nil || c.rawConn.IsClosed()
			c.mu.RUnlock()

			if !isClosed {
				continue
			}

			c.mu.Lock()
			c.reconnectAttempts++
			c.connected = false
			c.connectedSince = nil
			c.mu.Unlock()

			log.Printf("[RABBITMQ] Attempting reconnection (attempt #%d)...", c.reconnectAttempts)
			raw, err := amqp091.Dial(c.url)
			if err != nil {
				continue
			}

			now := time.Now().UTC()
			c.mu.Lock()
			c.rawConn = raw
			c.connected = true
			c.connectedSince = &now
			c.mu.Unlock()

			log.Printf("[RABBITMQ] Reconnected successfully to broker")
		}
	}
}
