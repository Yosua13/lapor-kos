package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds process-level settings resolved from the environment.
//
// Redis and RabbitMQ are optional infrastructure dependencies: leaving their
// variables empty disables the integration so the API keeps serving with
// PostgreSQL alone (graceful degradation).
type Config struct {
	Port           string
	DatabaseURL    string
	TrustedProxies []string
	Redis          RedisConfig
	RabbitMQ       RabbitMQConfig
}

// Load resolves and validates configuration from environment variables.
func Load() (Config, error) {
	config := Config{
		Port:           strings.TrimSpace(os.Getenv("PORT")),
		DatabaseURL:    strings.TrimSpace(os.Getenv("DATABASE_URL")),
		TrustedProxies: splitCSV(os.Getenv("TRUSTED_PROXIES")),
	}
	if config.Port == "" {
		config.Port = "8081"
	}
	if config.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL environment variable is required")
	}

	redisConfig, err := loadRedisConfig()
	if err != nil {
		return Config{}, err
	}
	config.Redis = redisConfig

	rabbitMQConfig, err := loadRabbitMQConfig()
	if err != nil {
		return Config{}, err
	}
	config.RabbitMQ = rabbitMQConfig

	return config, nil
}

func splitCSV(value string) []string {
	items := strings.Split(value, ",")
	result := make([]string, 0, len(items))
	for _, item := range items {
		if item = strings.TrimSpace(item); item != "" {
			result = append(result, item)
		}
	}
	return result
}
