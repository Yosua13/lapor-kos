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

func TestPropertyCache(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	ctx := context.Background()
	propID := uuid.New()

	// 1. Initial state: cache miss returns nil, nil
	cached, err := GetPropertyCache(ctx, client, propID)
	require.NoError(t, err)
	assert.Nil(t, cached)

	// 2. Set cache
	expected := &PropertySummaryCache{
		ID:          propID,
		Name:        "Kost Melati Indah",
		Address:     "Jl. Kaliurang KM 5",
		TotalRooms:  20,
		ActiveRooms: 18,
	}
	err = SetPropertyCache(ctx, client, propID, expected, 10*time.Minute)
	require.NoError(t, err)

	// 3. Get cache hit
	cached, err = GetPropertyCache(ctx, client, propID)
	require.NoError(t, err)
	assert.NotNil(t, cached)
	assert.Equal(t, expected.Name, cached.Name)
	assert.Equal(t, expected.TotalRooms, cached.TotalRooms)

	// 4. Test convenience method on *Client
	cachedMethod, err := client.GetPropertyCache(ctx, propID)
	require.NoError(t, err)
	assert.NotNil(t, cachedMethod)
	assert.Equal(t, expected.Address, cachedMethod.Address)

	// 5. Test nil client
	_, err = GetPropertyCache(ctx, nil, propID)
	assert.Error(t, err)
	assert.Equal(t, ErrRedisUnavailable, err)
}
