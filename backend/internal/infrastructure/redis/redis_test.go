package redis

import (
	"context"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/alicebob/miniredis/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedisClient_Disabled(t *testing.T) {
	client, err := NewClient(config.RedisConfig{})
	require.NoError(t, err)
	assert.False(t, client.IsEnabled())
	assert.Nil(t, client.Raw())

	health := client.Ping(context.Background())
	assert.Equal(t, model.DependencyStatusDisabled, health.Status)
	assert.False(t, health.Enabled)

	assert.NoError(t, client.Close())
}

func TestRedisClient_MiniredisLiveAndDisconnected(t *testing.T) {
	s := miniredis.RunT(t)

	client, err := NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	assert.True(t, client.IsEnabled())
	assert.NotNil(t, client.Raw())

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	// Initial ping should be connected
	health := client.Ping(ctx)
	assert.Equal(t, model.DependencyStatusConnected, health.Status)
	assert.True(t, health.Enabled)
	assert.GreaterOrEqual(t, health.LatencyMs, 0.0)
	assert.NotNil(t, health.ConnectedSince)

	// Set and Get via Raw client
	err = client.Raw().Set(ctx, "test_key", "test_val", time.Minute).Err()
	assert.NoError(t, err)
	val, err := client.Raw().Get(ctx, "test_key").Result()
	assert.NoError(t, err)
	assert.Equal(t, "test_val", val)

	// Close miniredis server to test graceful degradation
	s.Close()

	// Ping should now report disconnected without crashing
	failedHealth := client.Ping(ctx)
	assert.Equal(t, model.DependencyStatusDisconnected, failedHealth.Status)
	assert.True(t, failedHealth.Enabled)
	assert.NotEmpty(t, failedHealth.Error)

	assert.NoError(t, client.Close())
}
