package middleware

import (
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/redis"
	"github.com/gin-gonic/gin"
)

// DistributedRateLimit creates a Gin middleware that enforces a sliding window
// rate limit backed by Redis ZSET. If Redis is unconfigured or encounters an
// error, it falls back transparently to the local in-memory rate limiter.
func DistributedRateLimit(client *redis.Client, maxRequests int, window time.Duration) gin.HandlerFunc {
	if maxRequests <= 0 {
		maxRequests = 10
	}
	if window <= 0 {
		window = time.Minute
	}

	// Prepare fallback in-memory rate limiter
	fallbackLimiter := RateLimit(maxRequests, window)

	return func(c *gin.Context) {
		if client == nil || !client.IsEnabled() {
			fallbackLimiter(c)
			return
		}

		key := c.ClientIP() + ":" + c.FullPath()
		if key == c.ClientIP()+":" {
			key = c.ClientIP() + ":" + c.Request.URL.Path
		}

		allowed, err := redis.CheckSlidingRateLimit(c.Request.Context(), client, key, maxRequests, window)
		if err != nil {
			// Redis connectivity or runtime error: degrade gracefully to in-memory limiter
			log.Printf("[RATE_LIMIT] redis sliding check error for key %s: %v, falling back to memory", key, err)
			fallbackLimiter(c)
			return
		}

		if !allowed {
			retryAfter := int(window.Seconds())
			if retryAfter < 1 {
				retryAfter = 1
			}
			c.Header("Retry-After", strconv.Itoa(retryAfter))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "Too many requests, please try again later"})
			return
		}

		c.Next()
	}
}
