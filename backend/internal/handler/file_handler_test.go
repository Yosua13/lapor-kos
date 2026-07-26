package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestSignPropertyFileRejectsAnotherPropertyNamespace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	authorizedPropertyID := uuid.New()
	otherPropertyID := uuid.New()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("property_scope", model.PropertyScope{
			PropertyID: authorizedPropertyID,
			ActorID:    uuid.New(),
		})
		c.Next()
	})
	router.GET("/files/sign", NewFileHandler(nil).SignPropertyFile)

	request := httptest.NewRequest(
		http.MethodGet,
		"/files/sign?key=properties/"+otherPropertyID.String()+"/proof.jpg",
		nil,
	)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusNotFound, response.Body.String())
	}
}

func TestSignPropertyFileRejectsPrefixConfusion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	propertyID := uuid.New()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("property_scope", model.PropertyScope{PropertyID: propertyID})
		c.Next()
	})
	router.GET("/files/sign", NewFileHandler(nil).SignPropertyFile)

	request := httptest.NewRequest(
		http.MethodGet,
		"/files/sign?key=properties/"+propertyID.String()+"-attacker/proof.jpg",
		nil,
	)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusNotFound, response.Body.String())
	}
}

func TestSignPropertyFileRejectsTenantDocumentNamespace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	propertyID := uuid.New()

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("property_scope", model.PropertyScope{PropertyID: propertyID, ActorID: uuid.New()})
		c.Next()
	})
	router.GET("/files/sign", NewFileHandler(nil).SignPropertyFile)

	request := httptest.NewRequest(
		http.MethodGet,
		"/files/sign?key=properties/"+propertyID.String()+"/tenant-profiles/"+uuid.New().String()+"/ktp.jpg",
		nil,
	)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d; body=%s", response.Code, http.StatusNotFound, response.Body.String())
	}
}
