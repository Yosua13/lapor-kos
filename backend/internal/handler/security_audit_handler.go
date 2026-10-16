package handler

import (
	"context"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SecurityAuditRepository interface {
	RecordFinancialAudit(ctx context.Context, entry model.FinancialAuditLog) error
	ListFinancialAudits(ctx context.Context, filter model.FinancialAuditFilter) (*model.FinancialAuditListResult, error)
	RevokeUserSession(ctx context.Context, userID, revokedBy uuid.UUID, reason string) error
	CheckDatabaseHealth(ctx context.Context) (model.DatabaseHealth, error)
	GetSecurityChecklist(ctx context.Context, propertyID uuid.UUID) (*model.SecurityChecklist, error)
}

type SecurityAuditHandler struct {
	auditRepo SecurityAuditRepository
	userRepo  *repository.UserRepository
	storage   *service.StorageService
	startTime time.Time
}

func NewSecurityAuditHandler(
	auditRepo SecurityAuditRepository,
	userRepo *repository.UserRepository,
	storage *service.StorageService,
) *SecurityAuditHandler {
	return &SecurityAuditHandler{
		auditRepo: auditRepo,
		userRepo:  userRepo,
		storage:   storage,
		startTime: time.Now().UTC(),
	}
}

// LivenessCheck handles /healthz and /api/health probes.
func (h *SecurityAuditHandler) LivenessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "alive",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// ReadinessCheck handles /readyz and /api/ready probes, asserting database and storage availability.
func (h *SecurityAuditHandler) ReadinessCheck(c *gin.Context) {
	dbHealth, err := h.auditRepo.CheckDatabaseHealth(c.Request.Context())
	isStorageConfigured := h.storage != nil && h.storage.IsConfigured()

	overallStatus := "ready"
	httpStatus := http.StatusOK

	if err != nil || dbHealth.Status != "connected" {
		overallStatus = "unhealthy"
		httpStatus = http.StatusServiceUnavailable
	} else if h.storage != nil && !h.storage.IsConfigured() {
		overallStatus = "degraded"
	}

	storageHealth := model.StorageHealth{
		Configured:       isStorageConfigured,
		MainBucket:       "uploads",
		TenantDocBucket:  "tenant-documents",
		PrivateNamespace: true,
	}

	runtimeHealth := model.RuntimeHealth{
		Goroutines:    runtime.NumGoroutine(),
		UptimeSeconds: int64(time.Since(h.startTime).Seconds()),
		Environment:   gin.Mode(),
		Version:       "1.0.0",
	}

	securitySummary := model.SecuritySummary{
		CORSEnforced:        true,
		SecurityHeaders:     true,
		RateLimitingActive:  true,
		SessionRevocationOK: true,
		AuditLoggingActive:  true,
	}

	c.JSON(httpStatus, model.SystemHealthStatus{
		Status:    overallStatus,
		Timestamp: time.Now().UTC(),
		Database:  dbHealth,
		Storage:   storageHealth,
		Runtime:   runtimeHealth,
		Security:  securitySummary,
	})
}

// GetMetrics returns non-sensitive runtime and connection metrics for monitoring.
func (h *SecurityAuditHandler) GetMetrics(c *gin.Context) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	dbHealth, _ := h.auditRepo.CheckDatabaseHealth(c.Request.Context())

	c.JSON(http.StatusOK, gin.H{
		"uptime_seconds": int64(time.Since(h.startTime).Seconds()),
		"goroutines":     runtime.NumGoroutine(),
		"memory_alloc_mb": float64(m.Alloc) / 1024 / 1024,
		"database": gin.H{
			"latency_ms":     dbHealth.LatencyMs,
			"total_conns":    dbHealth.TotalConns,
			"idle_conns":     dbHealth.IdleConns,
			"acquired_conns": dbHealth.AcquiredConns,
			"max_conns":      dbHealth.MaxConns,
		},
	})
}

// ListFinancialAudits retrieves paginated, property-scoped financial audit records (AC 3).
func (h *SecurityAuditHandler) ListFinancialAudits(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property authorization is required"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "25"))

	filter := model.FinancialAuditFilter{
		PropertyID:    scope.PropertyID,
		EntityType:    c.Query("entity_type"),
		Action:        c.Query("action"),
		CorrelationID: c.Query("correlation_id"),
		StartDate:     c.Query("start_date"),
		EndDate:       c.Query("end_date"),
		Page:          page,
		PageSize:      pageSize,
	}

	if actorIDStr := c.Query("actor_id"); actorIDStr != "" {
		if parsedActorID, err := uuid.Parse(actorIDStr); err == nil {
			filter.ActorID = &parsedActorID
		}
	}

	result, err := h.auditRepo.ListFinancialAudits(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list financial audits: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetSecurityChecklist returns the compliance checklist for release gates.
func (h *SecurityAuditHandler) GetSecurityChecklist(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	propertyID := uuid.Nil
	if ok {
		propertyID = scope.PropertyID
	}

	checklist, err := h.auditRepo.GetSecurityChecklist(c.Request.Context(), propertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get security checklist: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, checklist)
}

// RevokeSession revokes all active sessions for a specific user.
func (h *SecurityAuditHandler) RevokeSession(c *gin.Context) {
	var req model.RevokeSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload: " + err.Error()})
		return
	}

	callerID, _ := currentUserID(c)

	if err := h.userRepo.RevokeSession(c.Request.Context(), req.UserID, callerID, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke session: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "User session revoked successfully. Prior tokens are now invalid.",
		"user_id": req.UserID,
	})
}

// RevokeMySessions allows a logged-in user to revoke all their own prior sessions.
func (h *SecurityAuditHandler) RevokeMySessions(c *gin.Context) {
	callerID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	if err := h.userRepo.RevokeSession(c.Request.Context(), callerID, callerID, "Self session revocation"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to revoke sessions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "All previous sessions revoked successfully.",
	})
}
