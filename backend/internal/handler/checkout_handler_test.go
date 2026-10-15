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

func TestCheckoutHandlerPropertyScopeRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &CheckoutHandler{}

	t.Run("ListCheckouts requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/checkouts", nil)
		h.ListCheckouts(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateCheckout requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateCheckout(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("RecordInspections requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/"+uuid.New().String()+"/inspections", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.RecordInspections(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("PreviewSettlement requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/checkouts/"+uuid.New().String()+"/settlement-preview", nil)
		h.PreviewSettlement(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ApproveSettlement requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/"+uuid.New().String()+"/approve", nil)
		h.ApproveSettlement(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ExecuteCheckout requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/"+uuid.New().String()+"/execute", nil)
		h.ExecuteCheckout(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("OverrideRoom requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/"+uuid.New().String()+"/room-override", nil)
		h.OverrideRoom(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestCheckoutHandlerValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &CheckoutHandler{}

	propID := uuid.New()
	scope := model.PropertyScope{
		PropertyID: propID,
		Role:       model.PropertyRoleOwner,
	}

	t.Run("CreateCheckout invalid JSON body", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", scope)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts", strings.NewReader(`{invalid json`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateCheckout(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("OverrideRoom invalid checkout ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", scope)
		c.Params = gin.Params{{Key: "id", Value: "invalid-uuid"}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/invalid-uuid/room-override", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.OverrideRoom(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("CancelCheckout invalid checkout ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", scope)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/checkouts/not-a-uuid/cancel", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CancelCheckout(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}
