package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type TenantHandler struct {
	repo           *repository.TenantRepository
	storageService *service.StorageService
}

func NewTenantHandler(repo *repository.TenantRepository, storageService *service.StorageService) *TenantHandler {
	return &TenantHandler{repo: repo, storageService: storageService}
}

func (h *TenantHandler) CreateTenant(c *gin.Context) {
	var req model.CreateTenantRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, _ := uuid.Parse(userIDStr.(string))

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

	// Handle file uploads to Supabase Storage
	ktpPath, _ := h.uploadFile(c, "ktp")
	selfiePath, _ := h.uploadFile(c, "selfie")

	rentalDuration := req.RentalDuration
	if rentalDuration <= 0 {
		rentalDuration = 1 // default to 1 month
	}

	email := req.Email
	if email == "" {
		email = req.Phone + "@tenant.com"
	}

	tenant := &model.Tenant{
		RoomID:    roomIDPtr,
		Name:      req.Name,
		Email:     email,
		Phone:     req.Phone,
		KTPURL:    ktpPath,
		SelfieURL: selfiePath,
		Contract: &model.Contract{
			StartDate:      entryDate,
			RentalDuration: rentalDuration,
		},
	}

	if err := h.repo.Create(c.Request.Context(), tenant, ownerID); err != nil {
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
	if entryDate.IsZero() && existing.Contract != nil {
		entryDate = existing.Contract.StartDate
	}

	cleanRoomID := strings.Trim(req.RoomID, `[]" `)
	var roomIDPtr *uuid.UUID
	if parsedUUID, err := uuid.Parse(cleanRoomID); err == nil {
		roomIDPtr = &parsedUUID
	} else {
		roomIDPtr = existing.RoomID
	}

	ktpPath, _ := h.uploadFile(c, "ktp")
	if ktpPath == "" {
		ktpPath = existing.KTPURL
	}

	selfiePath, _ := h.uploadFile(c, "selfie")
	if selfiePath == "" {
		selfiePath = existing.SelfieURL
	}

	rentalDuration := req.RentalDuration
	if rentalDuration <= 0 && existing.Contract != nil {
		rentalDuration = existing.Contract.RentalDuration
	}

	tenant := &model.Tenant{
		ID:        id,
		RoomID:    roomIDPtr,
		Name:      req.Name,
		Phone:     req.Phone,
		KTPURL:    ktpPath,
		SelfieURL: selfiePath,
		Contract: &model.Contract{
			StartDate:      entryDate,
			RentalDuration: rentalDuration,
		},
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

	// Note: Files are stored in Supabase Storage; no local file deletion needed.

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete tenant"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tenant deleted successfully"})
}

// uploadFile uploads a file from the multipart form to Supabase Storage and returns its public URL.
func (h *TenantHandler) uploadFile(c *gin.Context, fieldName string) (string, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}
	return h.storageService.UploadFile(fileHeader, fieldName)
}

func (h *TenantHandler) GetMyTenantProfile(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	tenant, err := h.repo.FindByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant profile not found"})
		return
	}

	c.JSON(http.StatusOK, tenant)
}

