package redis

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// SetSessionRevocation stores a user's session revocation timestamp in Redis with a TTL.
// Tokens issued at or before this timestamp are considered revoked and rejected in O(1).
func SetSessionRevocation(ctx context.Context, client *Client, userID uuid.UUID, ttl time.Duration, revokedAfter ...time.Time) error {
	if client == nil || client.Raw() == nil {
		return nil
	}
	if userID == uuid.Nil {
		return fmt.Errorf("user ID cannot be nil")
	}

	at := time.Now()
	if len(revokedAfter) > 0 && !revokedAfter[0].IsZero() {
		at = revokedAfter[0]
	}

	if ttl <= 0 {
		ttl = 30 * 24 * time.Hour // default matches 30-day JWT lifespan
	}

	key := fmt.Sprintf("revoked:user:%s", userID.String())
	val := at.Format(time.RFC3339Nano)

	return client.Raw().Set(ctx, key, val, ttl).Err()
}

// SetSessionRevocation is a convenience method on *Client.
func (c *Client) SetSessionRevocation(ctx context.Context, userID uuid.UUID, ttl time.Duration, revokedAfter ...time.Time) error {
	return SetSessionRevocation(ctx, c, userID, ttl, revokedAfter...)
}
