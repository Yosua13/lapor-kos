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

func TestInvoiceHandlerPropertyScopeRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &InvoiceHandler{}

	t.Run("List requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/invoices", nil)
		h.List(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("Generate requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/invoices/generate", strings.NewReader(`{"period":"2026-10"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.Generate(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetPolicy requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/billing/policy", nil)
		h.GetPolicy(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestInvoiceHandlerTenantScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &InvoiceHandler{}

	t.Run("ListMine unauthorized without user", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/invoices/my", nil)
		h.ListMine(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("GetMine rejects invalid invoice ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("user_id", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: "invalid-uuid"}}
		c.Request = httptest.NewRequest(http.MethodGet, "/api/invoices/invalid-uuid/my", nil)
		h.GetMine(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestInvoiceHandlerValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &InvoiceHandler{}
	propID := uuid.New()
	actorID := uuid.New()
	invoiceID := uuid.New()

	setScope := func(c *gin.Context) {
		c.Set("property_scope", model.PropertyScope{
			PropertyID:   propID,
			ActorID:      actorID,
			Role:         model.PropertyRoleOwner,
			MembershipID: uuid.New(),
		})
	}

	t.Run("Generate invalid period format", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		setScope(c)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/invoices/generate", strings.NewReader(`{"period":"2026/10"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.Generate(c)
		require.Equal(t, http.StatusUnprocessableEntity, w.Code)
	})

	t.Run("PreviewAdjustment rejects zero amount", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		setScope(c)
		c.Params = gin.Params{{Key: "id", Value: invoiceID.String()}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/invoices/"+invoiceID.String()+"/adjustments/preview", strings.NewReader(`{"description":"Discount","amount_minor":0,"reason":"Promo"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.PreviewAdjustment(c)
		require.Equal(t, http.StatusUnprocessableEntity, w.Code)
	})

	t.Run("PreviewAdjustment rejects empty reason", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		setScope(c)
		c.Params = gin.Params{{Key: "id", Value: invoiceID.String()}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/invoices/"+invoiceID.String()+"/adjustments/preview", strings.NewReader(`{"description":"Discount","amount_minor":-50000,"reason":"   "}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.PreviewAdjustment(c)
		require.Equal(t, http.StatusUnprocessableEntity, w.Code)
	})

	t.Run("RecordMeter rejects invalid body", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		setScope(c)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/billing/meter-readings", strings.NewReader(`{invalid}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.RecordMeter(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}
