package handler

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ComplaintHandler struct {
	complaintRepo  *repository.ComplaintRepository
	userRepo       repository.UserRepo
	aiService      service.AIServiceInterface
	waService      service.WhatsAppServiceInterface
	storageService *service.StorageService
}

func NewComplaintHandler(
	complaintRepo *repository.ComplaintRepository,
	userRepo repository.UserRepo,
	aiService service.AIServiceInterface,
	waService service.WhatsAppServiceInterface,
	storageService *service.StorageService,
) *ComplaintHandler {
	return &ComplaintHandler{
		complaintRepo:  complaintRepo,
		userRepo:       userRepo,
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
	roomID, ownerID, err := h.complaintRepo.FindActiveContractByTenantUser(c.Request.Context(), userID)
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

		// Ambil data WhatsApp group link milik owner
		ownerUser, err := h.userRepo.FindByID(c.Request.Context(), ownerID)
		if err == nil && ownerUser.WhatsAppGroupLink != nil && *ownerUser.WhatsAppGroupLink != "" {
			// Kirim pesan riil / simulasi ke WhatsApp group
			sent, sendErr := h.waService.SendMessageToGroup(c.Request.Context(), *ownerUser.WhatsAppGroupLink, *waMessage)
			if sendErr == nil && sent {
				waSent = true
			}
		}
	}

	// 4. Simpan komplain ke database
	complaint := &model.Complaint{
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

	if err := h.complaintRepo.Create(c.Request.Context(), complaint); err != nil {
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

	complaints, err := h.complaintRepo.FindByOwner(c.Request.Context(), userID)
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
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
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

	err = h.complaintRepo.UpdateStatus(c.Request.Context(), complaintID, ownerID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui status komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status komplain berhasil diperbarui"})
}

func (h *ComplaintHandler) UpdateWhatsAppGroup(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return
	}

	var req model.UpdateWhatsAppGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.userRepo.UpdateWhatsAppGroupLink(c.Request.Context(), ownerID, req.WhatsAppGroupLink)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui grup WhatsApp: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tautan grup WhatsApp berhasil diperbarui"})
}

func (h *ComplaintHandler) UploadPhoto(c *gin.Context) {
	fileHeader, err := c.FormFile("photo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File foto wajib diunggah"})
		return
	}

	photoURL, err := h.storageService.UploadFile(fileHeader, "complaint")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan file foto: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"photo_url": photoURL})
}
