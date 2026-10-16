package redis

import (
	"context"
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/redis/go-redis/v9"
)

// NewClient initializes a resilient Redis client with connection pooling.
// If Redis configuration is omitted, it returns a disabled client so the backend
// degrades gracefully without crashing.
func NewClient(cfg config.RedisConfig) (*Client, error) {
	if cfg.URL == "" && cfg.Addr == "" {
		return &Client{enabled: false}, nil
	}

	var opts *redis.Options
	if cfg.URL != "" {
		parsedOpts, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return nil, err
		}
		opts = parsedOpts
	} else {
		opts = &redis.Options{
			Addr:     cfg.Addr,
			Password: cfg.Password,
			DB:       cfg.DB,
		}
	}

	// Connection pool and timeout tuning
	opts.PoolSize = 20
	opts.MinIdleConns = 5
	opts.DialTimeout = 3 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second
	opts.DisableIdentity = true

	raw := redis.NewClient(opts)

	client := &Client{
		rawClient: raw,
		enabled:   true,
	}

	// Initial connectivity probe with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := raw.Ping(ctx).Err(); err != nil {
		log.Printf("[REDIS] Warning: initial ping failed (%v); client will retry on demand", err)
		client.connected = false
	} else {
		now := time.Now().UTC()
		client.connected = true
		client.connectedSince = &now
		log.Printf("[REDIS] Connected to Redis at %s (DB: %d)", opts.Addr, opts.DB)
	}

	return client, nil
}
