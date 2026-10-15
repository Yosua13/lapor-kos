package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CheckoutHandler struct {
	repo *repository.CheckoutRepository
	db   *pgxpool.Pool
}

func NewCheckoutHandler(repo *repository.CheckoutRepository, db *pgxpool.Pool) *CheckoutHandler {
	return &CheckoutHandler{repo: repo, db: db}
}

func checkoutScope(c *gin.Context) (model.PropertyScope, bool) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
	}
	return scope, ok
}

func checkoutError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, repository.ErrCheckoutNotFound):
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrCheckoutAlreadyExists):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	case errors.Is(err, repository.ErrCheckoutTerminalState),
		errors.Is(err, repository.ErrHandoverIncomplete),
		errors.Is(err, repository.ErrContractNotActive),
		errors.Is(err, repository.ErrCheckoutInvalidStatus):
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
	}
}

func (h *CheckoutHandler) resolveTenantProperty(c *gin.Context, tenantID uuid.UUID) (propertyID uuid.UUID, contractID uuid.UUID, err error) {
	row := h.db.QueryRow(c.Request.Context(), `
		SELECT property_id, id FROM contracts WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1
	`, tenantID)
	err = row.Scan(&propertyID, &contractID)
	return propertyID, contractID, err
}

// CreateCheckout handles staff-initiated checkout notice.
func (h *CheckoutHandler) CreateCheckout(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	var req model.CreateCheckoutNoticeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID := scope.ActorID
	result, err := h.repo.CreateCheckoutNotice(c.Request.Context(), scope.PropertyID, actorID, req)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Checkout notice submitted successfully",
		"data":    result,
	})
}

// ListCheckouts handles property-scoped list of checkouts.
func (h *CheckoutHandler) ListCheckouts(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := model.CheckoutListFilter{
		Status:    strings.TrimSpace(c.Query("status")),
		StartDate: strings.TrimSpace(c.Query("start_date")),
		EndDate:   strings.TrimSpace(c.Query("end_date")),
		Page:      page,
		PageSize:  pageSize,
	}

	if tIDStr := c.Query("tenant_id"); tIDStr != "" {
		if tID, err := uuid.Parse(tIDStr); err == nil {
			filter.TenantID = &tID
		}
	}
	if rIDStr := c.Query("room_id"); rIDStr != "" {
		if rID, err := uuid.Parse(rIDStr); err == nil {
			filter.RoomID = &rID
		}
	}

	resp, err := h.repo.ListCheckoutCases(c.Request.Context(), scope.PropertyID, filter)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": resp})
}

// GetCheckout handles retrieving a single checkout case.
func (h *CheckoutHandler) GetCheckout(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	result, err := h.repo.GetCheckoutCase(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}

// RecordInspections handles saving physical inspection checklist items and key handover.
func (h *CheckoutHandler) RecordInspections(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	var req model.RecordInspectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID := scope.ActorID
	result, err := h.repo.RecordInspections(c.Request.Context(), scope.PropertyID, id, actorID, req)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Room inspection and handover status recorded successfully",
		"data":    result,
	})
}

// PreviewSettlement calculates the real-time final statement.
func (h *CheckoutHandler) PreviewSettlement(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	preview, err := h.repo.PreviewSettlement(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": preview})
}

// ApproveSettlement handles management approval of the settlement statement.
func (h *CheckoutHandler) ApproveSettlement(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	var req model.ApproveSettlementRequest
	_ = c.ShouldBindJSON(&req)

	actorID := scope.ActorID
	result, err := h.repo.ApproveSettlement(c.Request.Context(), scope.PropertyID, id, actorID, req.Notes)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Checkout settlement approved successfully",
		"data":    result,
	})
}

// ExecuteCheckout executes the atomic final closure of tenancy and room status.
func (h *CheckoutHandler) ExecuteCheckout(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	var req model.ExecuteCheckoutRequest
	_ = c.ShouldBindJSON(&req)

	actorID := scope.ActorID
	result, err := h.repo.ExecuteCheckout(c.Request.Context(), scope.PropertyID, id, actorID, req)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Checkout and final settlement executed successfully",
		"data":    result,
	})
}

// CancelCheckout handles cancelling an open checkout request.
func (h *CheckoutHandler) CancelCheckout(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	var req model.CancelCheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID := scope.ActorID
	if err := h.repo.CancelCheckout(c.Request.Context(), scope.PropertyID, id, actorID, req.Reason); err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Checkout case cancelled successfully"})
}

// OverrideRoom allows manager to force room status with an audited reason (AC 1).
func (h *CheckoutHandler) OverrideRoom(c *gin.Context) {
	scope, ok := checkoutScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	var req model.RoomOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	actorID := scope.ActorID
	if err := h.repo.OverrideRoomStatus(c.Request.Context(), scope.PropertyID, id, actorID, req.TargetRoomStatus, req.Reason); err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Room status override applied successfully"})
}

// --- Tenant Self-Service Endpoints ---

// TenantCreateNotice handles tenant filing their own checkout notice.
func (h *CheckoutHandler) TenantCreateNotice(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req model.CreateCheckoutNoticeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Resolve property and contract if not supplied
	propertyID, contractID, err := h.resolveTenantProperty(c, tenantID)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "No active contract found for your account"})
		return
	}
	if req.ContractID == "" {
		req.ContractID = contractID.String()
	}

	result, err := h.repo.CreateCheckoutNotice(c.Request.Context(), propertyID, tenantID, req)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Checkout notice submitted successfully",
		"data":    result,
	})
}

// TenantListCheckouts lists all checkouts filed by the authenticated tenant.
func (h *CheckoutHandler) TenantListCheckouts(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	items, err := h.repo.ListCheckoutCasesForTenant(c.Request.Context(), tenantID)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": items})
}

// TenantGetCheckout retrieves a single checkout for the authenticated tenant.
func (h *CheckoutHandler) TenantGetCheckout(c *gin.Context) {
	tenantID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid checkout ID"})
		return
	}

	result, err := h.repo.GetCheckoutCaseForTenant(c.Request.Context(), tenantID, id)
	if err != nil {
		checkoutError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": result})
}
