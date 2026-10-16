package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ComplaintHandler struct {
	complaintRepo    *repository.ComplaintRepository
	aiService        service.AIServiceInterface
	waService        service.WhatsAppServiceInterface
	storageService   *service.StorageService
	notificationRepo *repository.NotificationRepository
	rabbitConn       *rabbitmq.Connection
}

func NewComplaintHandler(
	complaintRepo *repository.ComplaintRepository,
	aiService service.AIServiceInterface,
	waService service.WhatsAppServiceInterface,
	storageService *service.StorageService,
	notificationRepo *repository.NotificationRepository,
) *ComplaintHandler {
	return &ComplaintHandler{
		complaintRepo:    complaintRepo,
		aiService:        aiService,
		waService:        waService,
		storageService:   storageService,
		notificationRepo: notificationRepo,
	}
}

// WithRabbitMQ associates a RabbitMQ connection for asynchronous AI triage and alerts.
func (h *ComplaintHandler) WithRabbitMQ(c *rabbitmq.Connection) *ComplaintHandler {
	h.rabbitConn = c
	return h
}

// CreateComplaint handles tenant filing a complaint.
// AC 1: High priority triggers triage rules and measurable alert.
// AC 5: AI or channel failure does not block complaint persistence.
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

	// 1. Resolve tenancy boundary
	roomID, ownerID, propertyID, err := h.complaintRepo.FindActiveContractByTenantUser(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penyewa harus memiliki kontrak aktif untuk mengirimkan komplain."})
		return
	}

	priority := model.ComplaintPriorityMedium
	if req.Priority != nil && *req.Priority != "" {
		priority = *req.Priority
	}
	impact := model.ComplaintImpactMinor
	if req.Impact != nil && *req.Impact != "" {
		impact = *req.Impact
	}

	// 2. Generate empathic response via AI (non-blocking fallback)
	aiResponse, err := h.aiService.GenerateEmpathicResponse(c.Request.Context(), req.Category, req.Title, req.Description)
	if err != nil || aiResponse == "" {
		aiResponse = "Laporan Anda telah kami terima dan akan segera ditindaklanjuti oleh pengelola kos."
	}

	// 3. If noisy, send group warning if configured
	var waSent bool
	var waMessage *string
	if req.Category == "noisy" {
		warningText, err := h.aiService.GenerateGroupWarning(c.Request.Context(), req.Description)
		if err == nil && warningText != "" {
			waMessage = &warningText
		} else {
			defaultWarning := "Himbauan Lapor Kos: Harap tenang dan menjaga kenyamanan bersama di jam malam/istirahat. Terima kasih."
			waMessage = &defaultWarning
		}

		groupLink, err := h.complaintRepo.FindPropertyWhatsAppGroupLink(c.Request.Context(), propertyID)
		if err == nil && groupLink != "" {
			sent, sendErr := h.waService.SendMessageToGroup(c.Request.Context(), groupLink, *waMessage)
			if sendErr == nil && sent {
				waSent = true
			}
		}
	}

	// 4. Save complaint to database
	complaint := &model.Complaint{
		PropertyID:       propertyID,
		UserID:           userID,
		OwnerID:          ownerID,
		RoomID:           roomID,
		Title:            req.Title,
		Description:      req.Description,
		Category:         req.Category,
		Priority:         priority,
		Impact:           impact,
		Status:           model.ComplaintStatusPending,
		AccessWindow:     req.AccessWindow,
		PreferredContact: req.PreferredContact,
		PhotoURL:         req.PhotoURL,
		AIResponse:       &aiResponse,
		WASent:           waSent,
		WAMessage:        waMessage,
	}

	if err := h.complaintRepo.Create(c.Request.Context(), complaint); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Penyewa harus memiliki kontrak aktif untuk mengirimkan komplain."})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan komplain: " + err.Error()})
		return
	}

	// 5. Generate and store AI suggestion (asynchronous/non-blocking via RabbitMQ - AC 5)
	if h.rabbitConn != nil && h.rabbitConn.IsConnected() {
		_ = rabbitmq.PublishAITriageJob(c.Request.Context(), h.rabbitConn, &rabbitmq.AITriageJob{
			ComplaintID:   complaint.ID,
			PropertyID:    complaint.PropertyID,
			Title:         complaint.Title,
			Description:   complaint.Description,
			Category:      complaint.Category,
			CorrelationID: c.GetString("correlation_id"),
		})
	} else {
		go func(comp model.Complaint) {
			bgCtx := context.Background()
			suggestion, err := h.aiService.GenerateAdvisory(bgCtx, comp.Category, comp.Title, comp.Description)
			if err == nil && suggestion != nil {
				suggestion.ComplaintID = comp.ID
				suggestion.PropertyID = comp.PropertyID
				_ = h.complaintRepo.SaveAISuggestion(bgCtx, suggestion)
			}
		}(*complaint)
	}

	// 6. AC 1: High priority alert into notification outbox
	if (complaint.Priority == model.ComplaintPriorityUrgent || complaint.Impact == model.ComplaintImpactEmergency) && h.notificationRepo != nil {
		alertTitle := fmt.Sprintf("ALERT DARURAT: Komplain %s", complaint.Title)
		alertBody := fmt.Sprintf("Penyewa melaporkan masalah darurat: %s. Harap segera lakukan triage dan tindakan.", complaint.Description)
		payloadBytes, _ := json.Marshal(map[string]interface{}{
			"complaint_id": complaint.ID,
			"priority":     complaint.Priority,
			"impact":       complaint.Impact,
			"category":     complaint.Category,
			"title":        alertTitle,
			"body":         alertBody,
		})

		_, _ = h.notificationRepo.EnqueueOutbox(c.Request.Context(), &model.NotificationOutboxItem{
			PropertyID:    complaint.PropertyID,
			EventType:     "complaint.urgent_alert",
			AggregateType: "complaint",
			AggregateID:   complaint.ID,
			RecipientID:   &complaint.OwnerID,
			Channel:       "all",
			Priority:      "urgent",
			Payload:       payloadBytes,
		})
	}

	c.JSON(http.StatusCreated, complaint)
}

// GetTenantComplaints returns complaints filed by the authenticated tenant.
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

// GetTenantComplaintByID returns a specific complaint for the tenant.
func (h *ComplaintHandler) GetTenantComplaintByID(c *gin.Context) {
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

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	complaint, err := h.complaintRepo.FindByTenantAndID(c.Request.Context(), id, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, complaint)
}

// TenantConfirmResolution confirms complaint resolution (AC 3).
func (h *ComplaintHandler) TenantConfirmResolution(c *gin.Context) {
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

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.ConfirmResolutionRequest
	_ = c.ShouldBindJSON(&req)

	err = h.complaintRepo.TenantConfirmResolution(c.Request.Context(), id, userID, req.Comment)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Penyelesaian komplain berhasil dikonfirmasi"})
}

// TenantReopenComplaint reopens a resolved complaint (AC 3).
func (h *ComplaintHandler) TenantReopenComplaint(c *gin.Context) {
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

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.ReopenComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.complaintRepo.TenantReopen(c.Request.Context(), id, userID, req.Reason)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Tiket komplain berhasil dibuka kembali"})
}

// GetOwnerComplaints returns property complaints for staff.
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

// GetComplaintByID returns full details of a complaint for staff.
func (h *ComplaintHandler) GetComplaintByID(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	complaint, err := h.complaintRepo.FindByID(c.Request.Context(), id, scope.PropertyID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, complaint)
}

// UpdateComplaintStatus updates complaint status.
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

	var actorID *uuid.UUID
	if scope.ActorID != uuid.Nil {
		actorID = &scope.ActorID
	}
	actorRole := string(scope.Role)

	err = h.complaintRepo.UpdateStatus(c.Request.Context(), complaintID, scope.PropertyID, req.Status, actorID, "Staff", actorRole, req.Notes)
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

// TriageComplaint updates priority, impact, access window, and SLA due targets (AC 1).
func (h *ComplaintHandler) TriageComplaint(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.TriageComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var actorID *uuid.UUID
	if scope.ActorID != uuid.Nil {
		actorID = &scope.ActorID
	}

	err = h.complaintRepo.Triage(c.Request.Context(), id, scope.PropertyID, req.Priority, req.Impact, req.AccessWindow, req.FirstResponseDueAt, req.ResolutionDueAt, actorID, "Staff", string(scope.Role), req.Reason)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melakukan triage komplain: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Triage komplain berhasil disimpan"})
}

// AssignComplaint assigns a PIC staff member to the complaint.
func (h *ComplaintHandler) AssignComplaint(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.AssignComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var actorID *uuid.UUID
	if scope.ActorID != uuid.Nil {
		actorID = &scope.ActorID
	}

	err = h.complaintRepo.Assign(c.Request.Context(), id, scope.PropertyID, req.AssignedTo, actorID, "Staff", string(scope.Role), req.Notes)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menugaskan PIC: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "PIC berhasil ditugaskan"})
}

// GetComplaintTimeline returns timeline events.
// AC 2: Tenant only receives public events; internal notes/vendor costs are hidden!
func (h *ComplaintHandler) GetComplaintTimeline(c *gin.Context) {
	idStr := c.Param("id")
	complaintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	// Check if called in tenant context or property context
	scope, hasScope := middleware.GetPropertyScope(c)
	var isTenant bool
	var propertyID uuid.UUID

	if hasScope {
		propertyID = scope.PropertyID
		isTenant = false
	} else {
		// Tenant context
		userIDStr, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID, _ := uuid.Parse(userIDStr.(string))
		// Verify tenant owns this complaint
		comp, err := h.complaintRepo.FindByTenantAndID(c.Request.Context(), complaintID, userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
			return
		}
		propertyID = comp.PropertyID
		isTenant = true
	}

	events, err := h.complaintRepo.ListEvents(c.Request.Context(), complaintID, propertyID, isTenant)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil riwayat timeline: " + err.Error()})
		return
	}

	if events == nil {
		events = []model.ComplaintEvent{}
	}

	c.JSON(http.StatusOK, events)
}

// AddComplaintEvent adds a comment or event to the timeline.
func (h *ComplaintHandler) AddComplaintEvent(c *gin.Context) {
	idStr := c.Param("id")
	complaintID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Komplain tidak valid"})
		return
	}

	var req model.AddComplaintEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scope, hasScope := middleware.GetPropertyScope(c)
	var propertyID uuid.UUID
	var actorID *uuid.UUID
	var actorName string
	var actorRole string
	visibility := req.Visibility

	if hasScope {
		propertyID = scope.PropertyID
		if scope.ActorID != uuid.Nil {
			actorID = &scope.ActorID
		}
		actorName = "Staff Pengelola"
		actorRole = string(scope.Role)
	} else {
		// Tenant context
		userIDStr, exists := c.Get("user_id")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			return
		}
		userID, _ := uuid.Parse(userIDStr.(string))
		comp, err := h.complaintRepo.FindByTenantAndID(c.Request.Context(), complaintID, userID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Komplain tidak ditemukan"})
			return
		}
		propertyID = comp.PropertyID
		actorID = &userID
		actorName = "Penyewa"
		actorRole = "tenant"
		visibility = model.EventVisibilityPublic // Tenant comments are always public
	}

	event := &model.ComplaintEvent{
		ComplaintID: complaintID,
		PropertyID:  propertyID,
		ActorID:     actorID,
		ActorName:   actorName,
		ActorRole:   actorRole,
		EventType:   req.EventType,
		Visibility:  visibility,
		Message:     req.Message,
	}

	if err := h.complaintRepo.AddEvent(c.Request.Context(), event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambahkan komentar: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, event)
}

// GetAISuggestion returns the latest AI recommendation for a complaint.
func (h *ComplaintHandler) GetAISuggestion(c *gin.Context) {
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

	suggestion, err := h.complaintRepo.GetAISuggestion(c.Request.Context(), complaintID, scope.PropertyID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Saran AI belum tersedia untuk tiket ini"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil saran AI: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, suggestion)
}

// ApplyAISuggestion allows staff to apply AI recommendation with human override.
func (h *ComplaintHandler) ApplyAISuggestion(c *gin.Context) {
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

	var req model.ApplyAISuggestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.complaintRepo.ApplyAISuggestion(c.Request.Context(), complaintID, scope.PropertyID, scope.ActorID, req)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Saran AI tidak ditemukan"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menerapkan saran AI: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Saran AI berhasil diterapkan"})
}

// GetSLADashboard returns analytics on first response time, resolution time, and SLA status (AC 4).
func (h *ComplaintHandler) GetSLADashboard(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	stats, err := h.complaintRepo.GetSLADashboardStats(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memuat metrik SLA: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

// Work Order Handlers

func (h *ComplaintHandler) ListWorkOrders(c *gin.Context) {
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

	orders, err := h.complaintRepo.ListWorkOrders(c.Request.Context(), complaintID, scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar work order: " + err.Error()})
		return
	}

	if orders == nil {
		orders = []model.WorkOrder{}
	}

	c.JSON(http.StatusOK, orders)
}

func (h *ComplaintHandler) CreateWorkOrder(c *gin.Context) {
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

	var req model.CreateWorkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdBy *uuid.UUID
	if scope.ActorID != uuid.Nil {
		createdBy = &scope.ActorID
	}

	wo := &model.WorkOrder{
		ComplaintID:   complaintID,
		PropertyID:    scope.PropertyID,
		VendorID:      req.VendorID,
		Title:         req.Title,
		Description:   req.Description,
		ScheduledDate: req.ScheduledDate,
		EstimatedCost: req.EstimatedCost,
		ActualCost:    req.ActualCost,
		InvoiceURL:    req.InvoiceURL,
		Notes:         req.Notes,
		CreatedBy:     createdBy,
	}

	if err := h.complaintRepo.CreateWorkOrder(c.Request.Context(), wo, "Staff", string(scope.Role)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membuat work order: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, wo)
}

func (h *ComplaintHandler) UpdateWorkOrder(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	woIDStr := c.Param("wo_id")
	woID, err := uuid.Parse(woIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Work Order tidak valid"})
		return
	}

	var req model.UpdateWorkOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var createdBy *uuid.UUID
	if scope.ActorID != uuid.Nil {
		createdBy = &scope.ActorID
	}

	wo := &model.WorkOrder{
		ID:            woID,
		PropertyID:    scope.PropertyID,
		VendorID:      req.VendorID,
		Title:         req.Title,
		Description:   req.Description,
		Status:        req.Status,
		ScheduledDate: req.ScheduledDate,
		EstimatedCost: req.EstimatedCost,
		ActualCost:    req.ActualCost,
		InvoiceURL:    req.InvoiceURL,
		Notes:         req.Notes,
		CreatedBy:     createdBy,
	}

	if err := h.complaintRepo.UpdateWorkOrder(c.Request.Context(), wo, "Staff", string(scope.Role)); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Work order tidak ditemukan"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui work order: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Work order berhasil diperbarui"})
}

// Vendor Handlers

func (h *ComplaintHandler) ListVendors(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	activeOnly := c.Query("active_only") == "true"
	vendors, err := h.complaintRepo.ListVendors(c.Request.Context(), scope.PropertyID, activeOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar vendor: " + err.Error()})
		return
	}

	if vendors == nil {
		vendors = []model.Vendor{}
	}

	c.JSON(http.StatusOK, vendors)
}

func (h *ComplaintHandler) CreateVendor(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	var req model.CreateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vendor := &model.Vendor{
		PropertyID:  scope.PropertyID,
		Name:        req.Name,
		ServiceType: req.ServiceType,
		Phone:       req.Phone,
		Email:       req.Email,
		Address:     req.Address,
		Notes:       req.Notes,
		IsActive:    true,
	}

	if err := h.complaintRepo.CreateVendor(c.Request.Context(), vendor); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menambahkan vendor: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, vendor)
}

func (h *ComplaintHandler) UpdateVendor(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	idStr := c.Param("id")
	vendorID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID Vendor tidak valid"})
		return
	}

	var req model.UpdateVendorRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	vendor := &model.Vendor{
		ID:          vendorID,
		PropertyID:  scope.PropertyID,
		Name:        req.Name,
		ServiceType: req.ServiceType,
		Phone:       req.Phone,
		Email:       req.Email,
		Address:     req.Address,
		Notes:       req.Notes,
		IsActive:    req.IsActive,
	}

	if err := h.complaintRepo.UpdateVendor(c.Request.Context(), vendor); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Vendor tidak ditemukan"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal memperbarui vendor: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Data vendor berhasil diperbarui"})
}

func (h *ComplaintHandler) UpdateWhatsAppGroup(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}
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
