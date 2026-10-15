package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestComplaintHandler_PropertyScopeRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &ComplaintHandler{}

	t.Run("GetOwnerComplaints requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/complaints", nil)
		h.GetOwnerComplaints(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("GetSLADashboard requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/complaints/sla-dashboard", nil)
		h.GetSLADashboard(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("TriageComplaint requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		body, _ := json.Marshal(model.TriageComplaintRequest{
			Priority: model.ComplaintPriorityUrgent,
			Impact:   model.ComplaintImpactEmergency,
		})
		c.Request = httptest.NewRequest(http.MethodPost, "/api/complaints/"+uuid.New().String()+"/triage", bytes.NewBuffer(body))
		c.Request.Header.Set("Content-Type", "application/json")
		h.TriageComplaint(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("AssignComplaint requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		body, _ := json.Marshal(model.AssignComplaintRequest{})
		c.Request = httptest.NewRequest(http.MethodPost, "/api/complaints/"+uuid.New().String()+"/assign", bytes.NewBuffer(body))
		c.Request.Header.Set("Content-Type", "application/json")
		h.AssignComplaint(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("ListWorkOrders requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		c.Request = httptest.NewRequest(http.MethodGet, "/api/complaints/"+uuid.New().String()+"/work-orders", nil)
		h.ListWorkOrders(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("ListVendors requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/vendors", nil)
		h.ListVendors(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}

func TestComplaintHandler_TenantReopenValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &ComplaintHandler{}

	t.Run("Reopen requires reason in request body", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("user_id", uuid.New().String())
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/complaints/"+uuid.New().String()+"/reopen", bytes.NewBufferString(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")

		h.TenantReopenComplaint(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Reopen requires valid user context", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: uuid.New().String()}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/complaints/"+uuid.New().String()+"/reopen", bytes.NewBufferString(`{"reason":"Masih rusak"}`))
		c.Request.Header.Set("Content-Type", "application/json")

		h.TenantReopenComplaint(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}
