package redis

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	goredis "github.com/redis/go-redis/v9"
)

// ErrRedisUnavailable is returned when the Redis client is nil, uninitialized, or offline.
var ErrRedisUnavailable = errors.New("redis client unavailable")

// IsSessionRevoked checks in O(1) time whether a user's session has been invalidated.
// If the key does not exist in Redis, the session is active and not revoked (returns false, nil).
// If the key exists, it compares the token's issuedAt against the revokedAfter timestamp.
// If Redis is unavailable or returns an error, it returns (false, err) so callers can fall back to PostgreSQL.
func IsSessionRevoked(ctx context.Context, client *Client, userID uuid.UUID, issuedAt ...time.Time) (bool, error) {
	if client == nil || client.Raw() == nil {
		return false, ErrRedisUnavailable
	}
	if userID == uuid.Nil {
		return false, fmt.Errorf("user ID cannot be nil")
	}

	key := fmt.Sprintf("revoked:user:%s", userID.String())
	val, err := client.Raw().Get(ctx, key).Result()
	if errors.Is(err, goredis.Nil) {
		// Key not present in Redis: session has never been revoked
		return false, nil
	}
	if err != nil {
		// Connection or command error
		return false, err
	}

	// Key exists in Redis: user session was revoked
	if len(issuedAt) > 0 && !issuedAt[0].IsZero() {
		revokedAfter, parseErr := time.Parse(time.RFC3339Nano, val)
		if parseErr == nil {
			// Token issued strictly AFTER revocation occurred is valid (new login session)
			if issuedAt[0].After(revokedAfter) {
				return false, nil
			}
		}
	}

	return true, nil
}

// IsSessionRevoked is a convenience method on *Client.
func (c *Client) IsSessionRevoked(ctx context.Context, userID uuid.UUID, issuedAt ...time.Time) (bool, error) {
	return IsSessionRevoked(ctx, c, userID, issuedAt...)
}
