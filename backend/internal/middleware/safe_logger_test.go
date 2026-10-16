package middleware

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestSafeStructuredLogger(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("logs structured json and redacts sensitive query keys", func(t *testing.T) {
		var buf bytes.Buffer
		r := gin.New()
		r.Use(CorrelationID())
		r.Use(SafeStructuredLogger(&buf))

		r.GET("/api/test", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
		})

		w := httptest.NewRecorder()
		req, _ := http.NewRequest(http.MethodGet, "/api/test?secret=my-secret-key&token=jwt.token.val&normal=123", nil)
		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var entry LogEntry
		err := json.Unmarshal(buf.Bytes(), &entry)
		assert.NoError(t, err)
		assert.Equal(t, "INFO", entry.Level)
		assert.Equal(t, 200, entry.Status)
		assert.NotEmpty(t, entry.CorrelationID)
		assert.Contains(t, entry.Path, "secret=%5BREDACTED%5D")
		assert.Contains(t, entry.Path, "token=%5BREDACTED%5D")
		assert.Contains(t, entry.Path, "normal=123")
		assert.NotContains(t, buf.String(), "my-secret-key")
	})
}
