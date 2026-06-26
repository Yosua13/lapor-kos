package middleware

import (
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const defaultMaxRequestBodyBytes int64 = 12 << 20

type CORSConfig struct {
	AllowedOrigins map[string]struct{}
}

type rateLimitEntry struct {
	count     int
	expiresAt time.Time
}

var (
	rateLimitMu    sync.Mutex
	rateLimitStore = map[string]rateLimitEntry{}
)

func CORSConfigFromEnv() CORSConfig {
	origins := map[string]struct{}{
		"http://localhost:3000":        {},
		"http://127.0.0.1:3000":        {},
		"https://lapor-kos.vercel.app": {},
	}

	values := []string{os.Getenv("FRONTEND_URL"), os.Getenv("ALLOWED_ORIGINS")}
	for _, value := range values {
		for _, origin := range strings.Split(value, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				origins[origin] = struct{}{}
			}
		}
	}

	return CORSConfig{AllowedOrigins: origins}
}

func CORSMiddleware(config CORSConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			if _, ok := config.AllowedOrigins[origin]; !ok {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Origin is not allowed"})
				return
			}

			header := c.Writer.Header()
			header.Set("Access-Control-Allow-Origin", origin)
			header.Set("Vary", "Origin")
			header.Set("Access-Control-Allow-Credentials", "true")
			header.Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization, X-Cron-Secret, accept, origin, Cache-Control, X-Requested-With")
			header.Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.Writer.Header()
		header.Set("X-Content-Type-Options", "nosniff")
		header.Set("X-Frame-Options", "DENY")
		header.Set("Referrer-Policy", "no-referrer")
		header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		header.Set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'none'")

		if os.Getenv("APP_ENV") == "production" || os.Getenv("GIN_MODE") == gin.ReleaseMode {
			header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}

		c.Next()
	}
}

func RequestSizeLimit(maxBytes int64) gin.HandlerFunc {
	if maxBytes <= 0 {
		maxBytes = defaultMaxRequestBodyBytes
	}

	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}

func RateLimit(maxRequests int, window time.Duration) gin.HandlerFunc {
	if maxRequests <= 0 {
		maxRequests = 10
	}
	if window <= 0 {
		window = time.Minute
	}

	return func(c *gin.Context) {
		now := time.Now()
		key := c.ClientIP() + ":" + c.FullPath()
		if key == c.ClientIP()+":" {
			key = c.ClientIP() + ":" + c.Request.URL.Path
		}

		rateLimitMu.Lock()
		cleanupExpiredRateLimits(now)

		entry := rateLimitStore[key]
		if entry.expiresAt.IsZero() || now.After(entry.expiresAt) {
			entry = rateLimitEntry{expiresAt: now.Add(window)}
		}
		entry.count++
		rateLimitStore[key] = entry
		remaining := time.Until(entry.expiresAt)
		limited := entry.count > maxRequests
		rateLimitMu.Unlock()

		if limited {
			retryAfter := int(remaining.Seconds())
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

func CronSecretMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		secret := os.Getenv("CRON_SECRET")
		if secret == "" || c.GetHeader("X-Cron-Secret") != secret {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
			return
		}

		c.Next()
	}
}

func cleanupExpiredRateLimits(now time.Time) {
	for key, entry := range rateLimitStore {
		if now.After(entry.expiresAt) {
			delete(rateLimitStore, key)
		}
	}
}
