package config

// RabbitMQConfig carries optional RabbitMQ connection settings.
// Leaving RABBITMQ_URL empty disables the broker integration.
type RabbitMQConfig struct {
	URL string
}
