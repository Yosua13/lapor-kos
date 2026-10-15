package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestNotificationHandlerAuthRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &NotificationHandler{}

	t.Run("ListNotifications requires user context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/notifications", nil)
		h.ListNotifications(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("MarkRead requires user context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/notifications/"+uuid.NewString()+"/read", nil)
		h.MarkRead(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetPreferences requires user context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/notifications/preferences", nil)
		h.GetPreferences(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ListOutbox requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/properties/"+uuid.NewString()+"/notifications/outbox", nil)
		h.ListOutbox(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("RetryOutboxItem requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/properties/"+uuid.NewString()+"/notifications/outbox/"+uuid.NewString()+"/retry", nil)
		h.RetryOutboxItem(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
