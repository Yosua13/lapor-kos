package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/redis"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDistributedRateLimit_WithRedis(t *testing.T) {
	gin.SetMode(gin.TestMode)
	s := miniredis.RunT(t)

	client, err := redis.NewClient(config.RedisConfig{
		Addr: s.Addr(),
	})
	require.NoError(t, err)
	defer client.Close()

	router := gin.New()
	router.GET("/test-limited", middleware.DistributedRateLimit(client, 2, 5*time.Second), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Request 1: OK
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodGet, "/test-limited", nil)
	req1.RemoteAddr = "192.168.1.10:12345"
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// Request 2: OK
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/test-limited", nil)
	req2.RemoteAddr = "192.168.1.10:12345"
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code)

	// Request 3: 429 Too Many Requests
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodGet, "/test-limited", nil)
	req3.RemoteAddr = "192.168.1.10:12345"
	router.ServeHTTP(w3, req3)
	assert.Equal(t, http.StatusTooManyRequests, w3.Code)
	assert.Equal(t, "5", w3.Header().Get("Retry-After"))

	// Fast forward past window in miniredis
	s.FastForward(6 * time.Second)

	// Request 4: OK again
	w4 := httptest.NewRecorder()
	req4, _ := http.NewRequest(http.MethodGet, "/test-limited", nil)
	req4.RemoteAddr = "192.168.1.10:12345"
	router.ServeHTTP(w4, req4)
	assert.Equal(t, http.StatusOK, w4.Code)
}

func TestDistributedRateLimit_FallbackWhenNil(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/test-nil-redis", middleware.DistributedRateLimit(nil, 2, time.Minute), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodGet, "/test-nil-redis", nil)
	req1.RemoteAddr = "192.168.1.50:12345"
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)
}
