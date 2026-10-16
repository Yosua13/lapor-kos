package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestCorrelationIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("generates new correlation ID when headers are missing", func(t *testing.T) {
		r := gin.New()
		r.Use(CorrelationID())

		var capturedID string
		r.GET("/test", func(c *gin.Context) {
			capturedID = GetCorrelationID(c)
			fromCtx := CorrelationIDFromContext(c.Request.Context())
			assert.Equal(t, capturedID, fromCtx)
			c.Status(http.StatusOK)
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.NotEmpty(t, capturedID)
		assert.Equal(t, capturedID, w.Header().Get("X-Correlation-ID"))
		assert.Equal(t, capturedID, w.Header().Get("X-Request-ID"))
	})

	t.Run("propagates existing correlation ID header", func(t *testing.T) {
		r := gin.New()
		r.Use(CorrelationID())

		customID := "custom-trace-uuid-12345"
		var capturedID string
		r.GET("/test", func(c *gin.Context) {
			capturedID = GetCorrelationID(c)
			c.Status(http.StatusOK)
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("X-Correlation-ID", customID)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
		assert.Equal(t, customID, capturedID)
		assert.Equal(t, customID, w.Header().Get("X-Correlation-ID"))
	})
}
