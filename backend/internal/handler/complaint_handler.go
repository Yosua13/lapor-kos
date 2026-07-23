package handler

import (
	"errors"
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ComplaintHandler struct {
	complaintRepo  *repository.ComplaintRepository
	aiService      service.AIServiceInterface
	waService      service.WhatsAppServiceInterface
	storageService *service.StorageService
}

func NewComplaintHandler(
	complaintRepo *repository.ComplaintRepository,
	aiService service.AIServiceInterface,
	waService service.WhatsAppServiceInterface,
	storageService *service.StorageService,
) *ComplaintHandler {
	return &ComplaintHandler{
		complaintRepo:  complaintRepo,
		aiService:      aiService,
		waService:      waService,
		storageService: storageService,
	}
}

func (h *ComplaintHandler) CreateComplaint(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	var req model.CreateComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Dapatkan room ID, dan owner ID berdasarkan active contract penyewa
	roomID, ownerID, propertyID, err := h.complaintRepo.FindActiveContractByTenantUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penyewa harus memiliki kontrak aktif untuk mengirimkan komplain."})
		return
	}

	// 2. Generate empathic response menggunakan AI
	aiResponse, err := h.aiService.GenerateEmpathicResponse(c.Request.Context(), req.Category, req.Title, req.Description)
	if err != nil {
		aiResponse = "Laporan Anda telah kami terima dan akan segera ditindaklanjuti oleh pengelola kos."
	}

	// 3. Jika kategori keributan ('noisy'), siapkan pengiriman pesan teguran ke WA grup
	var waSent bool
	var waMessage *string

	if req.Category == "noisy" {
		// Generate warning message menggunakan AI
		warningText, err := h.aiService.GenerateGroupWarning(c.Request.Context(), req.Description)
		if err == nil {
			waMessage = &warningText
		} else {
			defaultWarning := "Himbauan Lapor Kos: Harap tenang dan menjaga kenyamanan bersama di jam malam/istirahat. Terima kasih."
			waMessage = &defaultWarning
		}

		// Pengaturan grup adalah milik properti, bukan profil global owner.
		groupLink, err := h.complaintRepo.FindPropertyWhatsAppGroupLink(c.Request.Context(), propertyID)
		if err == nil && groupLink != "" {
			// Kirim pesan riil / simulasi ke WhatsApp group
			sent, sendErr := h.waService.SendMessageToGroup(c.Request.Context(), groupLink, *waMessage)
			if sendErr == nil && sent {
				waSent = true
			}
		}
	}

	// 4. Simpan komplain ke database
	complaint := &model.Complaint{
		PropertyID:  propertyID,
		UserID:      userID,
		OwnerID:     ownerID,
		RoomID:      roomID,
		Title:       req.Title,
		Description: req.Description,
		Category:    req.Category,
		Status:      "pending",
		PhotoURL:    req.PhotoURL,
		AIResponse:  &aiResponse,
		WASent:      waSent,
		WAMessage:   waMessage,
	}

	if err := h.complaintRepo.Create(c.Request.Context(), complaint); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penyewa harus memiliki kontrak aktif untuk mengirimkan komplain."})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, complaint)
}

func (h *ComplaintHandler) GetTenantComplaints(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	complaints, err := h.complaintRepo.FindByTenant(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar komplain: " + err.Error()})
		return
	}

	if complaints == nil {
		complaints = []model.Complaint{}
	}

	c.JSON(http.StatusOK, complaints)
}

func (h *ComplaintHandler) GetOwnerComplaints(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	complaints, err := h.complaintRepo.FindByProperty(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar komplain: " + err.Error()})
		return
	}

	if complaints == nil {
		complaints = []model.Complaint{}
	}

	c.JSON(http.StatusOK, complaints)
}

func (h *ComplaintHandler) UpdateComplaintStatus(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	idStr := c.Param("id")
	complaintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.UpdateComplaintStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.complaintRepo.UpdateStatus(c.Request.Context(), complaintID, scope.PropertyID, req.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status komplain berhasil diperbarui"})
}

func (h *ComplaintHandler) UpdateWhatsAppGroup(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}
	// The legacy schema stores this setting on the owner user. Do not let a
	// delegated staff membership accidentally update its own unrelated profile.
	if scope.Role != model.PropertyRoleOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "Forbidden"})
		return
	}

	var req model.UpdateWhatsAppGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.complaintRepo.UpdatePropertyWhatsAppGroupLink(c.Request.Context(), scope.PropertyID, req.WhatsAppGroupLink)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui grup WhatsApp: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tautan grup WhatsApp berhasil diperbarui"})
}

func (h *ComplaintHandler) UploadPhoto(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}
	_, _, propertyID, err := h.complaintRepo.FindActiveContractByTenantUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penyewa harus memiliki kontrak aktif untuk mengunggah foto."})
		return
	}

	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File foto wajib diunggah"})
		return
	}

	photoURL, err := h.storageService.UploadPropertyFile(fileHeader, propertyID, "complaint")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file foto: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"photo_url": photoURL})
}
