package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// PropertySummaryCache holds cached summary data for a property.
type PropertySummaryCache struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Address     string    `json:"address"`
	TotalRooms  int       `json:"total_rooms"`
	ActiveRooms int       `json:"active_rooms"`
}

// SetPropertyCache caches property summary data into Redis with a TTL.
func SetPropertyCache(ctx context.Context, client *Client, propID uuid.UUID, data *PropertySummaryCache, ttl time.Duration) error {
	if client == nil || !client.IsEnabled() || client.Raw() == nil || data == nil {
		return nil
	}
	if propID == uuid.Nil {
		return fmt.Errorf("property ID cannot be nil")
	}

	if ttl <= 0 {
		ttl = 15 * time.Minute
	}

	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal property cache data: %w", err)
	}

	key := fmt.Sprintf("cache:prop:%s", propID.String())
	return client.Raw().Set(ctx, key, payload, ttl).Err()
}

// SetPropertyCache is a convenience method on *Client.
func (c *Client) SetPropertyCache(ctx context.Context, propID uuid.UUID, data *PropertySummaryCache, ttl time.Duration) error {
	return SetPropertyCache(ctx, c, propID, data, ttl)
}
