package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RoomTransferHandler struct {
	repo *repository.RoomTransferRepository
	db   *pgxpool.Pool
}

func NewRoomTransferHandler(repo *repository.RoomTransferRepository, db *pgxpool.Pool) *RoomTransferHandler {
	return &RoomTransferHandler{repo: repo, db: db}
}

func transferScope(c *gin.Context) (model.PropertyScope, bool) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
	}
	return scope, ok
}

func transferError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrRoomTransferNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrRoomTransferUnavailable),
		errors.Is(err, repository.ErrRoomTransferConflict):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrRoomTransferSameRoom),
		errors.Is(err, repository.ErrRoomTransferInvalidDates),
		errors.Is(err, repository.ErrRoomTransferInvalidState),
		errors.Is(err, repository.ErrRoomTransferNoContract):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrRoomTransferUnauthorized):
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (h *RoomTransferHandler) resolveTenantProperty(c *gin.Context, tenantID uuid.UUID) (propertyID uuid.UUID, contractID uuid.UUID, err error) {
	row := h.db.QueryRow(c.Request.Context(), `
		SELECT property_id, id FROM contracts WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1
	`, tenantID)
	err = row.Scan(&propertyID, &contractID)
	return propertyID, contractID, err
}

// PreviewTransfer handles POST /api/room-transfers/preview (Staff)
func (h *RoomTransferHandler) PreviewTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	var req model.PreviewTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data request tidak valid: " + err.Error()})
		return
	}

	preview, err := h.repo.PreviewTransfer(
		c.Request.Context(),
		scope.PropertyID,
		req.ContractID,
		req.TenantID,
		req.ToRoomID,
		req.EffectiveDate,
		req.MoveFeeMinor,
	)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, preview)
}

// CreateTransfer handles POST /api/room-transfers (Staff)
func (h *RoomTransferHandler) CreateTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	var req model.CreateTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data request tidak valid: " + err.Error()})
		return
	}

	transfer, err := h.repo.CreateTransferRequest(c.Request.Context(), scope.PropertyID, scope.ActorID, req)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

// ApproveTransfer handles PUT /api/room-transfers/:id/approve (Staff)
func (h *RoomTransferHandler) ApproveTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	transfer, err := h.repo.ApproveTransfer(c.Request.Context(), scope.PropertyID, scope.ActorID, id)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// RejectTransfer handles PUT /api/room-transfers/:id/reject (Staff)
func (h *RoomTransferHandler) RejectTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	var req model.RejectTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan penolakan wajib diisi: " + err.Error()})
		return
	}

	transfer, err := h.repo.RejectTransfer(c.Request.Context(), scope.PropertyID, scope.ActorID, id, req.Reason)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// ExecuteTransfer handles POST /api/room-transfers/:id/execute (Staff)
func (h *RoomTransferHandler) ExecuteTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	transfer, err := h.repo.ExecuteTransfer(c.Request.Context(), scope.PropertyID, scope.ActorID, id)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// CancelTransfer handles POST /api/room-transfers/:id/cancel (Staff)
func (h *RoomTransferHandler) CancelTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	transfer, err := h.repo.CancelTransfer(c.Request.Context(), scope.PropertyID, scope.ActorID, id, true)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// GetTransfer handles GET /api/room-transfers/:id (Staff)
func (h *RoomTransferHandler) GetTransfer(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	transfer, err := h.repo.GetTransfer(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

// ListTransfers handles GET /api/room-transfers (Staff)
func (h *RoomTransferHandler) ListTransfers(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	status := strings.TrimSpace(c.Query("status"))
	list, err := h.repo.ListTransfers(c.Request.Context(), scope.PropertyID, status)
	if err != nil {
		transferError(c, err)
		return
	}

	if list == nil {
		list = []model.RoomTransfer{}
	}
	c.JSON(http.StatusOK, list)
}

// GetTenantRoomHistory handles GET /api/tenants/:id/room-history (Staff)
func (h *RoomTransferHandler) GetTenantRoomHistory(c *gin.Context) {
	scope, ok := transferScope(c)
	if !ok {
		return
	}

	tenantID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID tenant tidak valid"})
		return
	}

	var startDateFilter, endDateFilter *time.Time
	if startStr := strings.TrimSpace(c.Query("start_date")); startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startDateFilter = &t
		}
	}
	if endStr := strings.TrimSpace(c.Query("end_date")); endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			endDateFilter = &t
		}
	}

	history, err := h.repo.GetTenantRoomHistory(c.Request.Context(), scope.PropertyID, tenantID, startDateFilter, endDateFilter)
	if err != nil {
		transferError(c, err)
		return
	}

	if history == nil {
		history = []model.TenantRoomHistoryItem{}
	}
	c.JSON(http.StatusOK, history)
}

// --- Tenant Self-Service Endpoints ---

// PreviewMyTransfer handles POST /api/room-transfers/my/preview (Tenant)
func (h *RoomTransferHandler) PreviewMyTransfer(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	propertyID, contractID, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tidak ditemukan kontrak aktif untuk penghuni ini"})
		return
	}

	var req model.PreviewTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data request tidak valid: " + err.Error()})
		return
	}

	req.ContractID = &contractID
	req.TenantID = &tenantID

	preview, err := h.repo.PreviewTransfer(
		c.Request.Context(),
		propertyID,
		req.ContractID,
		req.TenantID,
		req.ToRoomID,
		req.EffectiveDate,
		req.MoveFeeMinor,
	)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, preview)
}

// CreateMyTransfer handles POST /api/room-transfers/my (Tenant)
func (h *RoomTransferHandler) CreateMyTransfer(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	propertyID, contractID, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tidak ditemukan kontrak aktif untuk penghuni ini"})
		return
	}

	var req model.CreateTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data request tidak valid: " + err.Error()})
		return
	}

	req.ContractID = &contractID
	req.TenantID = &tenantID

	transfer, err := h.repo.CreateTransferRequest(c.Request.Context(), propertyID, tenantID, req)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

// ListMyTransfers handles GET /api/room-transfers/my (Tenant)
func (h *RoomTransferHandler) ListMyTransfers(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	propertyID, _, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusOK, []model.RoomTransfer{})
		return
	}

	list, err := h.repo.ListTransfersForTenant(c.Request.Context(), propertyID, tenantID)
	if err != nil {
		transferError(c, err)
		return
	}

	if list == nil {
		list = []model.RoomTransfer{}
	}
	c.JSON(http.StatusOK, list)
}

// GetMyRoomHistory handles GET /api/tenants/me/room-history (Tenant)
func (h *RoomTransferHandler) GetMyRoomHistory(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	propertyID, _, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusOK, []model.TenantRoomHistoryItem{})
		return
	}

	var startDateFilter, endDateFilter *time.Time
	if startStr := strings.TrimSpace(c.Query("start_date")); startStr != "" {
		if t, err := time.Parse("2006-01-02", startStr); err == nil {
			startDateFilter = &t
		}
	}
	if endStr := strings.TrimSpace(c.Query("end_date")); endStr != "" {
		if t, err := time.Parse("2006-01-02", endStr); err == nil {
			endDateFilter = &t
		}
	}

	history, err := h.repo.GetTenantRoomHistory(c.Request.Context(), propertyID, tenantID, startDateFilter, endDateFilter)
	if err != nil {
		transferError(c, err)
		return
	}

	if history == nil {
		history = []model.TenantRoomHistoryItem{}
	}
	c.JSON(http.StatusOK, history)
}

// CancelMyTransfer handles POST /api/room-transfers/my/:id/cancel (Tenant)
func (h *RoomTransferHandler) CancelMyTransfer(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID pengajuan tidak valid"})
		return
	}

	propertyID, _, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tidak ditemukan kontrak aktif"})
		return
	}

	transfer, err := h.repo.CancelTransfer(c.Request.Context(), propertyID, tenantID, id, false)
	if err != nil {
		transferError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}
