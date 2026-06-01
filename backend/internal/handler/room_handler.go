package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type RoomHandler struct {
	repo           *repository.RoomRepository
	storageService *service.StorageService
}

func NewRoomHandler(repo *repository.RoomRepository, storageService *service.StorageService) *RoomHandler {
	return &RoomHandler{repo: repo, storageService: storageService}
}

func (h *RoomHandler) CreateRoom(c *gin.Context) {
	var req model.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Status == "" {
		req.Status = "available"
	}

	room := &model.Room{
		RoomNumber:    req.RoomNumber,
		PricePerMonth: req.PricePerMonth,
		Description:   req.Description,
		Status:        req.Status,
	}

	if err := h.repo.Create(c.Request.Context(), room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room"})
		return
	}

	c.JSON(http.StatusCreated, room)
}

func (h *RoomHandler) GetRooms(c *gin.Context) {
	rooms, err := h.repo.FindAll(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rooms"})
		return
	}
	c.JSON(http.StatusOK, rooms)
}

func (h *RoomHandler) GetRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	room, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Room not found"})
		return
	}
	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) UpdateRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	var req model.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room := &model.Room{
		ID:            id,
		RoomNumber:    req.RoomNumber,
		PricePerMonth: req.PricePerMonth,
		Description:   req.Description,
		Status:        req.Status,
	}

	if err := h.repo.Update(c.Request.Context(), room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update room"})
		return
	}

	c.JSON(http.StatusOK, room)
}

func (h *RoomHandler) DeleteRoom(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}

	deleteTenant := c.Query("delete_tenant") == "true"

	if err := h.repo.Delete(c.Request.Context(), id, deleteTenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete room"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room deleted successfully"})
}

func (h *RoomHandler) CreateRoomWithTenant(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, _ := uuid.Parse(userIDStr.(string))

	if err := c.Request.ParseMultipartForm(10 << 20); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form"})
		return
	}

	roomNumber := c.PostForm("room_number")
	priceStr := c.PostForm("price_per_month")
	description := c.PostForm("description")
	status := c.PostForm("status")
	
	price, _ := strconv.ParseFloat(priceStr, 64)
	if status == "" {
		status = "occupied"
	}

	room := &model.Room{
		RoomNumber:    roomNumber,
		PricePerMonth: price,
		Description:   description,
		Status:        status,
	}

	name := c.PostForm("name")
	phone := c.PostForm("phone")
	email := c.PostForm("email")
	entryDateStr := c.PostForm("entry_date")

	entryDate, _ := time.Parse("2006-01-02", entryDateStr)
	if entryDate.IsZero() {
		entryDate = time.Now()
	}

	rentalDurationStr := c.PostForm("rental_duration")
	rentalDuration, _ := strconv.Atoi(rentalDurationStr)
	if rentalDuration <= 0 {
		rentalDuration = 1
	}

	ktpPath, _ := h.uploadFile(c, "ktp")
	selfiePath, _ := h.uploadFile(c, "selfie")

	tenant := &model.Tenant{
		Name:      name,
		Phone:     phone,
		Email:     email,
		KTPURL:    ktpPath,
		SelfieURL: selfiePath,
		Contract: &model.Contract{
			StartDate:      entryDate,
			RentalDuration: rentalDuration,
		},
	}

	if err := h.repo.CreateWithTenant(c.Request.Context(), room, tenant, ownerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create room and tenant"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"room": room, "tenant": tenant})
}

// uploadFile uploads a file from the multipart form to Supabase Storage and returns its public URL.
func (h *RoomHandler) uploadFile(c *gin.Context, fieldName string) (string, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}
	return h.storageService.UploadFile(fileHeader, fieldName)
}
