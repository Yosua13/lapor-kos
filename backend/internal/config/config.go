package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	TrustedProxies []string
}

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
