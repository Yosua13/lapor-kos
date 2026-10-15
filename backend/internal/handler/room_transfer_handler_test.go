package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestRoomTransferHandlerPropertyScopeRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &RoomTransferHandler{}

	t.Run("ListTransfers requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/room-transfers", nil)
		h.ListTransfers(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("PreviewTransfer requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/room-transfers/preview", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.PreviewTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateTransfer requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/room-transfers", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ApproveTransfer requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/api/room-transfers/"+uuid.New().String()+"/approve", nil)
		h.ApproveTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("RejectTransfer requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPut, "/api/room-transfers/"+uuid.New().String()+"/reject", nil)
		h.RejectTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ExecuteTransfer requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/room-transfers/"+uuid.New().String()+"/execute", nil)
		h.ExecuteTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetTenantRoomHistory requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/tenants/"+uuid.New().String()+"/room-history", nil)
		h.GetTenantRoomHistory(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestRoomTransferHandlerValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &RoomTransferHandler{}

	t.Run("ApproveTransfer invalid UUID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", model.PropertyScope{PropertyID: uuid.New(), ActorID: uuid.New()})
		c.Params = gin.Params{{Key: "id", Value: "invalid-uuid"}}
		c.Request = httptest.NewRequest(http.MethodPut, "/api/room-transfers/invalid-uuid/approve", nil)
		h.ApproveTransfer(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "ID pengajuan tidak valid")
	})

	t.Run("RejectTransfer requires reason", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", model.PropertyScope{PropertyID: uuid.New(), ActorID: uuid.New()})
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		c.Request = httptest.NewRequest(http.MethodPut, "/api/room-transfers/id/reject", strings.NewReader(`{"reason":""}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.RejectTransfer(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("GetTenantRoomHistory invalid tenant ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", model.PropertyScope{PropertyID: uuid.New(), ActorID: uuid.New()})
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		c.Request = httptest.NewRequest(http.MethodGet, "/api/tenants/not-a-uuid/room-history", nil)
		h.GetTenantRoomHistory(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "ID tenant tidak valid")
	})
}

func TestRoomTransferHandlerTenantSelfServiceUnauthorized(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &RoomTransferHandler{}

	t.Run("ListMyTransfers unauthorized without token", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/room-transfers/my", nil)
		h.ListMyTransfers(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetMyRoomHistory unauthorized without token", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/tenants/me/room-history", nil)
		h.GetMyRoomHistory(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateMyTransfer unauthorized without token", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/room-transfers/my", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateMyTransfer(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
