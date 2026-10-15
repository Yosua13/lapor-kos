package handler

import (
	"errors"
	"net/http"
	"strconv"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type NotificationHandler struct {
	repo         *repository.NotificationRepository
	waService    service.WhatsAppServiceInterface
	emailService service.EmailServiceInterface
}

func NewNotificationHandler(
	repo *repository.NotificationRepository,
	waService service.WhatsAppServiceInterface,
	emailService service.EmailServiceInterface,
) *NotificationHandler {
	return &NotificationHandler{
		repo:         repo,
		waService:    waService,
		emailService: emailService,
	}
}

func getUserIDFromContext(c *gin.Context) (uuid.UUID, bool) {
	val, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return uuid.Nil, false
	}
	s, ok := val.(string)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user context"})
		return uuid.Nil, false
	}
	uid, err := uuid.Parse(s)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid user ID"})
		return uuid.Nil, false
	}
	return uid, true
}

func notificationScope(c *gin.Context) (model.PropertyScope, bool) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
	}
	return scope, ok
}

// ---------------------------------------------------------------------------
// In-App Inbox Endpoints (User-Facing)
// ---------------------------------------------------------------------------

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	category := c.Query("category")
	unreadOnly := c.Query("unread_only") == "true"
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.repo.ListUserNotifications(c.Request.Context(), userID, category, unreadOnly, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *NotificationHandler) MarkRead(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	if err := h.repo.MarkNotificationRead(c.Request.Context(), userID, notifID); err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *NotificationHandler) MarkAllRead(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	if err := h.repo.MarkAllNotificationsRead(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *NotificationHandler) DeleteNotification(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	notifID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	if err := h.repo.DeleteNotification(c.Request.Context(), userID, notifID); err != nil {
		if errors.Is(err, repository.ErrNotificationNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	count, err := h.repo.GetUnreadCount(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"unread_count": count})
}

// ---------------------------------------------------------------------------
// Preferences Endpoints (User-Facing)
// ---------------------------------------------------------------------------

func (h *NotificationHandler) GetPreferences(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	pref, err := h.repo.GetPreferences(c.Request.Context(), userID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pref)
}

func (h *NotificationHandler) UpdatePreferences(c *gin.Context) {
	userID, ok := getUserIDFromContext(c)
	if !ok {
		return
	}

	var req model.UpdatePreferencesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}

	// Fetch current to merge
	current, err := h.repo.GetPreferences(c.Request.Context(), userID, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if req.EmailEnabled != nil {
		current.EmailEnabled = *req.EmailEnabled
	}
	if req.WhatsAppEnabled != nil {
		current.WhatsAppEnabled = *req.WhatsAppEnabled
	}
	if req.InAppEnabled != nil {
		current.InAppEnabled = *req.InAppEnabled
	}
	if req.QuietHoursEnabled != nil {
		current.QuietHoursEnabled = *req.QuietHoursEnabled
	}
	if req.QuietHoursStart != nil {
		current.QuietHoursStart = *req.QuietHoursStart
	}
	if req.QuietHoursEnd != nil {
		current.QuietHoursEnd = *req.QuietHoursEnd
	}
	if req.QuietHoursTimezone != nil {
		current.QuietHoursTimezone = *req.QuietHoursTimezone
	}
	if req.OptOutCategories != nil {
		current.OptOutCategories = req.OptOutCategories
	}

	updated, err := h.repo.UpsertPreferences(c.Request.Context(), current)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// ---------------------------------------------------------------------------
// Staff / Owner Outbox & Delivery Monitoring Endpoints (Property-Scoped)
// ---------------------------------------------------------------------------

func (h *NotificationHandler) ListOutbox(c *gin.Context) {
	scope, ok := notificationScope(c)
	if !ok {
		return
	}

	status := c.Query("status")
	channel := c.Query("channel")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	resp, err := h.repo.ListOutbox(c.Request.Context(), scope.PropertyID, status, channel, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *NotificationHandler) GetOutboxItem(c *gin.Context) {
	scope, ok := notificationScope(c)
	if !ok {
		return
	}

	outboxID, err := uuid.Parse(c.Param("outboxId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid outbox ID"})
		return
	}

	item, err := h.repo.GetOutboxItem(c.Request.Context(), scope.PropertyID, outboxID)
	if err != nil {
		if errors.Is(err, repository.ErrOutboxNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Outbox item not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}

func (h *NotificationHandler) RetryOutboxItem(c *gin.Context) {
	scope, ok := notificationScope(c)
	if !ok {
		return
	}

	outboxID, err := uuid.Parse(c.Param("outboxId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid outbox ID"})
		return
	}

	item, err := h.repo.RetryOutboxItem(c.Request.Context(), scope.PropertyID, outboxID, h.waService, h.emailService)
	if err != nil {
		if errors.Is(err, repository.ErrOutboxNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Outbox item not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, item)
}
