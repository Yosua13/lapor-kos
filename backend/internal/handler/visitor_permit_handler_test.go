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

func TestParseDateTime(t *testing.T) {
	tests := []struct {
		input   string
		wantErr bool
	}{
		{"2026-10-20T14:00:00Z", false},
		{"2026-10-20T14:00:00", false},
		{"2026-10-20T14:00", false},
		{"2026-10-20 14:00:00", false},
		{"2026-10-20 14:00", false},
		{"2026-10-20", false},
		{"invalid-date", true},
		{"", true},
	}

	for _, tc := range tests {
		got, err := parseDateTime(tc.input)
		if tc.wantErr && err == nil {
			t.Errorf("parseDateTime(%q) expected error, got %v", tc.input, got)
		}
		if !tc.wantErr && err != nil {
			t.Errorf("parseDateTime(%q) unexpected error: %v", tc.input, err)
		}
	}
}

func TestVisitorPermitHandlerScopeRequired(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &VisitorPermitHandler{}

	t.Run("ListPermits requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/visitor-permits", nil)
		h.ListPermits(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("GetPermit requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/visitor-permits/"+uuid.New().String(), nil)
		h.GetPermit(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("ApprovePermit requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+uuid.New().String()+"/approve", nil)
		h.ApprovePermit(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("RejectPermit requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+uuid.New().String()+"/reject", nil)
		h.RejectPermit(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("CheckInVisitor requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+uuid.New().String()+"/check-in", nil)
		h.CheckInVisitor(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("CheckOutVisitor requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+uuid.New().String()+"/check-out", nil)
		h.CheckOutVisitor(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})

	t.Run("ApplyRetentionPolicy requires property scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/retention/apply", nil)
		h.ApplyRetentionPolicy(c)
		require.Equal(t, http.StatusForbidden, w.Code)
	})
}

func TestRejectPermitRequiresReason(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &VisitorPermitHandler{}

	propID := uuid.New()
	permitID := uuid.New()
	actorID := uuid.New()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+permitID.String()+"/reject", strings.NewReader(`{"reason": ""}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: permitID.String()}}
	c.Set("property_scope", model.PropertyScope{
		PropertyID: propID,
		Role:       model.PropertyRoleOwner,
		ActorID:    actorID,
	})
	c.Set("user_id", actorID.String())

	h.RejectPermit(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Alasan penolakan izin tamu wajib diisi")
}

func TestRequestChangePermitRequiresReason(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &VisitorPermitHandler{}

	propID := uuid.New()
	permitID := uuid.New()
	actorID := uuid.New()

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/"+permitID.String()+"/request-change", strings.NewReader(`{"reason": "   "}`))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Params = gin.Params{{Key: "id", Value: permitID.String()}}
	c.Set("property_scope", model.PropertyScope{
		PropertyID: propID,
		Role:       model.PropertyRoleManager,
		ActorID:    actorID,
	})
	c.Set("user_id", actorID.String())

	h.RequestChangePermit(c)
	require.Equal(t, http.StatusBadRequest, w.Code)
	require.Contains(t, w.Body.String(), "Alasan permohonan perubahan wajib diisi")
}

func TestTenantCreatePermitValidations(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &VisitorPermitHandler{}

	t.Run("missing user_id returns unauthorized", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/my", strings.NewReader(`{}`))
		h.TenantCreatePermit(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("invalid end time before start time", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{
			"guest_name": "Tamu Uji",
			"relationship": "Teman",
			"purpose": "Belajar bersama",
			"is_overnight": false,
			"start_time": "2026-10-20T15:00:00",
			"end_time": "2026-10-20T14:00:00"
		}`
		c.Request = httptest.NewRequest(http.MethodPost, "/api/visitor-permits/my", strings.NewReader(body))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Set("user_id", uuid.New().String())

		h.TenantCreatePermit(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "Waktu selesai harus lebih besar dari waktu mulai")
	})
}
