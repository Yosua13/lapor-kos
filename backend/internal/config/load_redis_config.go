package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// loadRedisConfig reads REDIS_URL, REDIS_ADDR, REDIS_PASSWORD, and REDIS_DB.
// Malformed values fail fast because they are operator errors, whereas an
// unreachable Redis server is tolerated at runtime.
func loadRedisConfig() (RedisConfig, error) {
	redisConfig := RedisConfig{
		URL:      strings.TrimSpace(os.Getenv("REDIS_URL")),
		Addr:     strings.TrimSpace(os.Getenv("REDIS_ADDR")),
		Password: os.Getenv("REDIS_PASSWORD"),
	}

	if redisConfig.URL != "" {
		if err := validateURLScheme("REDIS_URL", redisConfig.URL, "redis", "rediss"); err != nil {
			return RedisConfig{}, err
		}
	}

	if rawDB := strings.TrimSpace(os.Getenv("REDIS_DB")); rawDB != "" {
		db, err := strconv.Atoi(rawDB)
		if err != nil || db < 0 {
			return RedisConfig{}, fmt.Errorf("REDIS_DB must be a non-negative integer")
		}
		redisConfig.DB = db
	}

	return redisConfig, nil
}
