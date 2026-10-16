package redis

import (
	"context"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/alicebob/miniredis/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionRevocation(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	userID := uuid.New()

	// 1. Initial state: not revoked
	revoked, err := IsSessionRevoked(ctx, client, userID)
	require.NoError(t, err)
	assert.False(t, revoked, "expected session not revoked initially")

	// 2. Set revocation
	tRevoke := time.Now()
	err = SetSessionRevocation(ctx, client, userID, time.Hour, tRevoke)
	require.NoError(t, err)

	// 3. Verify token issued before revocation is revoked
	tOld := tRevoke.Add(-5 * time.Minute)
	revoked, err = IsSessionRevoked(ctx, client, userID, tOld)
	require.NoError(t, err)
	assert.True(t, revoked, "expected old token to be revoked")

	// 4. Verify token issued after revocation is valid
	tNew := tRevoke.Add(5 * time.Minute)
	revoked, err = IsSessionRevoked(ctx, client, userID, tNew)
	require.NoError(t, err)
	assert.False(t, revoked, "expected new token to be valid (not revoked)")

	// 5. Test convenience methods on *Client
	revokedMethod, err := client.IsSessionRevoked(ctx, userID, tOld)
	require.NoError(t, err)
	assert.True(t, revokedMethod)

	// 6. Check with nil client (graceful error)
	_, err = IsSessionRevoked(ctx, nil, userID)
	assert.Error(t, err)
	assert.Equal(t, ErrRedisUnavailable, err)
}
