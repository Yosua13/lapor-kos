package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
)

type FileHandler struct {
	storage *service.StorageService
}

func NewFileHandler(storage *service.StorageService) *FileHandler {
	return &FileHandler{storage: storage}
}

// SignPropertyFile issues a short-lived URL only when the object's namespace
// exactly matches the property authorized by middleware.
func (h *FileHandler) SignPropertyFile(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}
	objectKey := strings.TrimSpace(strings.TrimLeft(c.Query("key"), "/"))
	requiredPrefix := "properties/" + scope.PropertyID.String() + "/"
	if objectKey == "" || !strings.HasPrefix(objectKey, requiredPrefix) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	signedURL, err := h.storage.CreateSignedURL(objectKey, 5*time.Minute)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Failed to create file access URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": signedURL, "expires_in": 300})
}
