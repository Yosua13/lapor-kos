package redis

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
)

// GetPropertyCache retrieves cached property summary data from Redis.
// Returns (nil, nil) if the cache key does not exist (cache miss).
func GetPropertyCache(ctx context.Context, client *Client, propID uuid.UUID) (*PropertySummaryCache, error) {
	if client == nil || !client.IsEnabled() || client.Raw() == nil {
		return nil, ErrRedisUnavailable
	}
	if propID == uuid.Nil {
		return nil, fmt.Errorf("property ID cannot be nil")
	}

	key := fmt.Sprintf("cache:prop:%s", propID.String())
	payload, err := client.Raw().Get(ctx, key).Result()
	if errors.Is(err, goredis.Nil) {
		return nil, nil // cache miss
	}
	if err != nil {
		return nil, err
	}

	var data PropertySummaryCache
	if err := json.Unmarshal([]byte(payload), &data); err != nil {
		return nil, fmt.Errorf("failed to unmarshal property cache data: %w", err)
	}

	return &data, nil
}

// GetPropertyCache is a convenience method on *Client.
func (c *Client) GetPropertyCache(ctx context.Context, propID uuid.UUID) (*PropertySummaryCache, error) {
	return GetPropertyCache(ctx, c, propID)
}
