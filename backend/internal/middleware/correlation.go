package middleware

import (
	"context"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type correlationContextKey string

const (
	CorrelationIDContextKey                  = "correlation_id"
	CorrelationIDHeader                      = "X-Correlation-ID"
	RequestIDHeader                          = "X-Request-ID"
	CorrelationContextKey   correlationContextKey = "correlation_id"
)

// CorrelationID extracts or generates a unique correlation ID for every request,
// attaching it to Gin context, Go context.Context, and response headers.
func CorrelationID() gin.HandlerFunc {
	return func(c *gin.Context) {
		correlationID := strings.TrimSpace(c.GetHeader(CorrelationIDHeader))
		if correlationID == "" {
			correlationID = strings.TrimSpace(c.GetHeader(RequestIDHeader))
		}
		if correlationID == "" {
			correlationID = uuid.New().String()
		}

		c.Set(CorrelationIDContextKey, correlationID)
		c.Header(CorrelationIDHeader, correlationID)
		c.Header(RequestIDHeader, correlationID)

		ctx := context.WithValue(c.Request.Context(), CorrelationContextKey, correlationID)
		ctx = context.WithValue(ctx, "correlation_id", correlationID)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// GetCorrelationID retrieves the correlation ID from gin.Context.
func GetCorrelationID(c *gin.Context) string {
	if val, exists := c.Get(CorrelationIDContextKey); exists {
		if s, ok := val.(string); ok && s != "" {
			return s
		}
	}
	return ""
}

// CorrelationIDFromContext retrieves the correlation ID from context.Context.
func CorrelationIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if val, ok := ctx.Value(CorrelationContextKey).(string); ok && val != "" {
		return val
	}
	return ""
}
