package rabbitmq

import (
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/rabbitmq/amqp091-go"
)

// NewConnection connects to RabbitMQ and starts an automatic background
// reconnect supervisor. If RABBITMQ_URL is not set, it returns a disabled
// connection so the application continues running without crashing.
func NewConnection(cfg config.RabbitMQConfig) (*Connection, error) {
	if cfg.URL == "" {
		return &Connection{enabled: false}, nil
	}

	conn := &Connection{
		url:       cfg.URL,
		enabled:   true,
		closeChan: make(chan struct{}),
	}

	raw, err := amqp091.Dial(cfg.URL)
	if err != nil {
		log.Printf("[RABBITMQ] Warning: initial dial failed (%v); reconnect supervisor started", err)
		conn.connected = false
	} else {
		now := time.Now().UTC()
		conn.rawConn = raw
		conn.connected = true
		conn.connectedSince = &now
		log.Printf("[RABBITMQ] Connected to RabbitMQ broker")
	}

	go conn.startReconnectSupervisor()

	return conn, nil
}
