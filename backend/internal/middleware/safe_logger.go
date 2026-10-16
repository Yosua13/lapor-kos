package middleware

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

var sensitiveKeys = map[string]struct{}{
	"password":      {},
	"password_hash": {},
	"token":         {},
	"secret":        {},
	"otp":           {},
	"otp_code":      {},
	"code":          {},
	"nik":           {},
	"ktp":           {},
	"credit_card":   {},
	"authorization": {},
}

// LogEntry represents a safe, structured log format without secrets or PII.
type LogEntry struct {
	Timestamp     string `json:"timestamp"`
	Level         string `json:"level"`
	CorrelationID string `json:"correlation_id,omitempty"`
	PropertyID    string `json:"property_id,omitempty"`
	UserID        string `json:"user_id,omitempty"`
	Method        string `json:"method"`
	Path          string `json:"path"`
	Status        int    `json:"status"`
	LatencyMs     int64  `json:"latency_ms"`
	ClientIP      string `json:"client_ip"`
	ErrorMessage  string `json:"error_message,omitempty"`
}

// SafeStructuredLogger produces structured JSON logs with automatic redaction of sensitive parameters.
func SafeStructuredLogger(out io.Writer) gin.HandlerFunc {
	if out == nil {
		out = os.Stdout
	}

	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start).Milliseconds()

		correlationID := GetCorrelationID(c)
		propertyID := c.GetHeader("X-Property-ID")
		if propIDVal, exists := c.Get("property_id"); exists {
			if s, ok := propIDVal.(fmt.Stringer); ok {
				propertyID = s.String()
			} else if s, ok := propIDVal.(string); ok {
				propertyID = s
			}
		}

		userID := ""
		if uidVal, exists := c.Get("user_id"); exists {
			if s, ok := uidVal.(string); ok {
				userID = s
			}
		}

		level := "INFO"
		if c.Writer.Status() >= 500 {
			level = "ERROR"
		} else if c.Writer.Status() >= 400 {
			level = "WARN"
		}

		safePath := sanitizeQueryString(c.Request.URL)

		entry := LogEntry{
			Timestamp:     time.Now().UTC().Format(time.RFC3339),
			Level:         level,
			CorrelationID: correlationID,
			PropertyID:    propertyID,
			UserID:        userID,
			Method:        c.Request.Method,
			Path:          safePath,
			Status:        c.Writer.Status(),
			LatencyMs:     latency,
			ClientIP:      c.ClientIP(),
		}

		if len(c.Errors) > 0 {
			entry.ErrorMessage = c.Errors.String()
		}

		raw, err := json.Marshal(entry)
		if err == nil {
			_, _ = fmt.Fprintln(out, string(raw))
		}
	}
}

func sanitizeQueryString(u *url.URL) string {
	if u == nil {
		return ""
	}
	query := u.Query()
	for key := range query {
		if isSensitiveKey(key) {
			query.Set(key, "[REDACTED]")
		}
	}
	cleanURL := *u
	cleanURL.RawQuery = query.Encode()
	return cleanURL.RequestURI()
}

func isSensitiveKey(key string) bool {
	lower := strings.ToLower(strings.TrimSpace(key))
	if _, ok := sensitiveKeys[lower]; ok {
		return true
	}
	for s := range sensitiveKeys {
		if strings.Contains(lower, s) {
			return true
		}
	}
	return false
}
