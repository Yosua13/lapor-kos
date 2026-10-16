package config

import (
	"os"
	"strings"
)

// loadRabbitMQConfig reads RABBITMQ_URL and validates its scheme when present.
func loadRabbitMQConfig() (RabbitMQConfig, error) {
	rabbitMQConfig := RabbitMQConfig{URL: strings.TrimSpace(os.Getenv("RABBITMQ_URL"))}
	if rabbitMQConfig.URL == "" {
		return rabbitMQConfig, nil
	}
	if err := validateURLScheme("RABBITMQ_URL", rabbitMQConfig.URL, "amqp", "amqps"); err != nil {
		return RabbitMQConfig{}, err
	}
	return rabbitMQConfig, nil
}
