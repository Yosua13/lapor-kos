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

func TestFinanceHandlerScopeRequirement(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &FinanceHandler{}

	t.Run("GetDashboard requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/finance/dashboard", nil)
		h.GetDashboard(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ListExpenses requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/expenses", nil)
		h.ListExpenses(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateExpense requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/expenses", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateExpense(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("ClosePeriod requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/finance/period-closures", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.ClosePeriod(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateAdjustment requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/finance/period-closures/"+uuid.New().String()+"/adjustments", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateAdjustment(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})

	t.Run("CreateExportJob requires scope", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/finance/exports", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		h.CreateExportJob(c)
		require.Equal(t, http.StatusUnauthorized, w.Code)
	})
}

func TestFinanceHandlerValidationWithScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &FinanceHandler{}

	withScope := func(c *gin.Context) {
		c.Set("property_scope", model.PropertyScope{
			PropertyID: uuid.New(),
			ActorID:    uuid.New(),
			Role:       model.PropertyRoleOwner,
		})
	}

	t.Run("GetExpense with invalid uuid returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodGet, "/api/expenses/invalid-id", nil)
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		withScope(c)
		h.GetExpense(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("CreateExpense with invalid JSON returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/expenses", strings.NewReader(`{"title":""}`))
		c.Request.Header.Set("Content-Type", "application/json")
		withScope(c)
		h.CreateExpense(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("ClosePeriod with invalid JSON returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/finance/period-closures", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")
		withScope(c)
		h.ClosePeriod(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("CreateAdjustment with invalid period_close_id returns 400", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/finance/period-closures/bad-uuid/adjustments", strings.NewReader(`{"adjustment_type":"expense_adjustment","amount_minor":1000,"reason":"test"}`))
		c.Request.Header.Set("Content-Type", "application/json")
		c.Params = gin.Params{{Key: "period_close_id", Value: "bad-uuid"}}
		withScope(c)
		h.CreateAdjustment(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
	})
}
