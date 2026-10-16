package rabbitmq

import (
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRabbitMQConnection_Disabled(t *testing.T) {
	conn, err := NewConnection(config.RabbitMQConfig{})
	require.NoError(t, err)
	assert.False(t, conn.IsEnabled())
	assert.False(t, conn.IsConnected())
	assert.Nil(t, conn.Raw())

	health := conn.Ping()
	assert.Equal(t, model.DependencyStatusDisabled, health.Status)
	assert.False(t, health.Enabled)

	ch, err := conn.Channel()
	assert.Error(t, err)
	assert.Nil(t, ch)

	assert.NoError(t, conn.DeclareTopology())
	assert.NoError(t, conn.Close())
}

func TestRabbitMQConnection_UnreachableDegradesGracefully(t *testing.T) {
	// Point to a local port where no RabbitMQ is running
	conn, err := NewConnection(config.RabbitMQConfig{
		URL: "amqp://guest:guest@127.0.0.1:59999/",
	})
	require.NoError(t, err)
	assert.True(t, conn.IsEnabled())
	assert.False(t, conn.IsConnected())

	health := conn.Ping()
	assert.Equal(t, model.DependencyStatusDisconnected, health.Status)
	assert.True(t, health.Enabled)
	assert.NotEmpty(t, health.Error)

	ch, err := conn.Channel()
	assert.Error(t, err)
	assert.Nil(t, ch)

	// Close shuts down supervisor cleanly
	assert.NoError(t, conn.Close())
}
