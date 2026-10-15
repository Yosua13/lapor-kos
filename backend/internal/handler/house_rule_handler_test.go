package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestHouseRuleHandler_GetTemplates(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &HouseRuleHandler{}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/rules/templates", nil)

	h.GetTemplates(c)

	require.Equal(t, http.StatusOK, w.Code)
	var resp map[string][]model.RuleTemplateItem
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)
	require.NotEmpty(t, resp["templates"])
	require.GreaterOrEqual(t, len(resp["templates"]), 10)
}

func TestHouseRuleHandler_SaveDraft_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &HouseRuleHandler{}

	propID := uuid.New()
	actorID := uuid.New()
	scope := model.PropertyScope{
		PropertyID: propID,
		ActorID:    actorID,
		Role:       model.PropertyRoleOwner,
	}

	t.Run("Empty items rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", scope)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/rules/draft", strings.NewReader(`{"title":"Peraturan","items":[]}`))
		c.Request.Header.Set("Content-Type", "application/json")

		h.SaveDraft(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "minimal 1 butir")
	})

	t.Run("Missing scope rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = httptest.NewRequest(http.MethodPost, "/api/rules/draft", strings.NewReader(`{"title":"Peraturan","items":[{"title":"Item 1"}]}`))
		c.Request.Header.Set("Content-Type", "application/json")

		h.SaveDraft(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "Property context is required")
	})
}

func TestHouseRuleHandler_PublishVersion_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &HouseRuleHandler{}

	t.Run("Invalid version UUID rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", model.PropertyScope{
			PropertyID: uuid.New(),
			ActorID:    uuid.New(),
			Role:       model.PropertyRoleOwner,
		})
		c.Params = gin.Params{{Key: "version_id", Value: "not-a-uuid"}}
		c.Request = httptest.NewRequest(http.MethodPost, "/api/rules/versions/not-a-uuid/publish", strings.NewReader(`{}`))
		c.Request.Header.Set("Content-Type", "application/json")

		h.PublishVersion(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "Invalid version ID")
	})
}

func TestHouseRuleHandler_ListAcknowledgments_Validation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &HouseRuleHandler{}

	t.Run("Invalid version UUID rejected", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Set("property_scope", model.PropertyScope{
			PropertyID: uuid.New(),
			ActorID:    uuid.New(),
			Role:       model.PropertyRoleOwner,
		})
		c.Params = gin.Params{{Key: "version_id", Value: "invalid-id"}}
		c.Request = httptest.NewRequest(http.MethodGet, "/api/rules/versions/invalid-id/acknowledgments", nil)

		h.ListAcknowledgments(c)
		require.Equal(t, http.StatusBadRequest, w.Code)
		require.Contains(t, w.Body.String(), "Invalid version ID")
	})
}
