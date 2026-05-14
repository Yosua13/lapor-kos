package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TenantHandler struct {
	repo *repository.TenantRepository
}

func NewTenantHandler(repo *repository.TenantRepository) *TenantHandler {
	return &TenantHandler{repo: repo}
}

func (h *TenantHandler) CreateTenant(c *gin.Context) {
	var req model.CreateTenantRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Parse entry date
	entryDate, _ := time.Parse("2006-01-02", req.EntryDate)
	if entryDate.IsZero() {
		entryDate = time.Now()
	}

	// Clean RoomID string from any JSON array/brackets notation if sent incorrectly by multipart client
	cleanRoomID := strings.Trim(req.RoomID, `[]" `)
	var roomIDPtr *uuid.UUID
	if parsedUUID, err := uuid.Parse(cleanRoomID); err == nil {
		roomIDPtr = &parsedUUID
	}

	// Handle file uploads
	ktpPath, _ := h.saveFile(c, "ktp")
	selfiePath, _ := h.saveFile(c, "selfie")

	tenant := &model.Tenant{
		RoomID:    roomIDPtr,
		Name:      req.Name,
		Phone:     req.Phone,
		KTPURL:    ktpPath,
		SelfieURL: selfiePath,
		EntryDate: entryDate,
	}

	if err := h.repo.Create(c.Request.Context(), tenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create tenant"})
		return
	}

	c.JSON(http.StatusCreated, tenant)
}

func (h *TenantHandler) GetTenants(c *gin.Context) {
	tenants, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch tenants"})
		return
	}
	c.JSON(http.StatusOK, tenants)
}

func (h *TenantHandler) GetTenant(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant ID"})
		return
	}

	tenant, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
		return
	}
	c.JSON(http.StatusOK, tenant)
}

func (h *TenantHandler) UpdateTenant(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant ID"})
		return
	}

	var req model.CreateTenantRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	existing, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant not found"})
		return
	}

	entryDate, _ := time.Parse("2006-01-02", req.EntryDate)
	if entryDate.IsZero() {
		entryDate = existing.EntryDate
	}

	cleanRoomID := strings.Trim(req.RoomID, `[]" `)
	var roomIDPtr *uuid.UUID
	if parsedUUID, err := uuid.Parse(cleanRoomID); err == nil {
		roomIDPtr = &parsedUUID
	} else {
		roomIDPtr = existing.RoomID
	}

	ktpPath, _ := h.saveFile(c, "ktp")
	if ktpPath == "" {
		ktpPath = existing.KTPURL
	}

	selfiePath, _ := h.saveFile(c, "selfie")
	if selfiePath == "" {
		selfiePath = existing.SelfieURL
	}

	tenant := &model.Tenant{
		ID:        id,
		RoomID:    roomIDPtr,
		Name:      req.Name,
		Phone:     req.Phone,
		KTPURL:    ktpPath,
		SelfieURL: selfiePath,
		EntryDate: entryDate,
	}

	if err := h.repo.Update(c.Request.Context(), tenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update tenant"})
		return
	}

	c.JSON(http.StatusOK, tenant)
}

func (h *TenantHandler) DeleteTenant(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant ID"})
		return
	}

	// Find tenant to delete their associated image files from frontend folder
	if tenant, err := h.repo.FindByID(c.Request.Context(), id); err == nil {
		if tenant.KTPURL != "" {
			os.Remove(filepath.Join("..", "frontend", "public", filepath.Clean(tenant.KTPURL)))
		}
		if tenant.SelfieURL != "" {
			os.Remove(filepath.Join("..", "frontend", "public", filepath.Clean(tenant.SelfieURL)))
		}
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tenant"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tenant deleted successfully"})
}

func (h *TenantHandler) saveFile(c *gin.Context, fieldName string) (string, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}

	// Create uploads directory in frontend/public/uploads
	uploadDir := filepath.Join("..", "frontend", "public", "uploads")
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.MkdirAll(uploadDir, 0755)
	}

	// Generate unique filename
	filename := fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), uuid.New().String(), filepath.Ext(file.Filename))
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}
