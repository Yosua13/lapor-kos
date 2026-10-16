package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type FinanceHandler struct {
	repo       *repository.FinanceRepository
	rabbitConn *rabbitmq.Connection
}

func NewFinanceHandler(repo *repository.FinanceRepository) *FinanceHandler {
	return &FinanceHandler{repo: repo}
}

// WithRabbitMQ associates a RabbitMQ connection for asynchronous export processing.
func (h *FinanceHandler) WithRabbitMQ(c *rabbitmq.Connection) *FinanceHandler {
	h.rabbitConn = c
	return h
}

func financeScope(c *gin.Context) (model.PropertyScope, bool) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Property context is required"})
	}
	return scope, ok
}

// GetDashboard returns financial reconciliation summary (AC 1, AC 2, AC 3).
func (h *FinanceHandler) GetDashboard(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	periodStart := strings.TrimSpace(c.Query("period_start"))
	periodEnd := strings.TrimSpace(c.Query("period_end"))

	summary, err := h.repo.GetFinancialDashboard(c.Request.Context(), scope.PropertyID, periodStart, periodEnd)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// GetReceivablesAging returns aging buckets and unpaid issued invoices.
func (h *FinanceHandler) GetReceivablesAging(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	aging, err := h.repo.GetReceivablesAging(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, aging)
}

// ListExpenses returns paginated expenses with filters (AC 5).
func (h *FinanceHandler) ListExpenses(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	filter := model.ExpenseFilter{
		Category:  strings.TrimSpace(c.Query("category")),
		Status:    strings.TrimSpace(c.Query("status")),
		VendorID:  strings.TrimSpace(c.Query("vendor_id")),
		StartDate: strings.TrimSpace(c.Query("start_date")),
		EndDate:   strings.TrimSpace(c.Query("end_date")),
		Search:    strings.TrimSpace(c.Query("search")),
		Page:      page,
		PageSize:  pageSize,
	}

	expenses, total, err := h.repo.ListExpenses(c.Request.Context(), scope.PropertyID, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":      expenses,
		"total":     total,
		"page":      filter.Page,
		"page_size": filter.PageSize,
	})
}

// GetExpense returns details for a single expense.
func (h *FinanceHandler) GetExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	expense, err := h.repo.GetExpenseByID(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		if errors.Is(err, repository.ErrExpenseNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, expense)
}

// CreateExpense records an operational expense (blocked if period closed, AC 4).
func (h *FinanceHandler) CreateExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	var req model.CreateExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expense, err := h.repo.CreateExpense(c.Request.Context(), scope.PropertyID, scope.ActorID, req)
	if err != nil {
		if errors.Is(err, repository.ErrPeriodClosed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, expense)
}

// UpdateExpense updates an existing expense.
func (h *FinanceHandler) UpdateExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	var req model.UpdateExpenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	expense, err := h.repo.UpdateExpense(c.Request.Context(), scope.PropertyID, id, scope.ActorID, req)
	if err != nil {
		if errors.Is(err, repository.ErrPeriodClosed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, repository.ErrExpenseNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Expense not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, expense)
}

// ApproveExpense approves a pending expense.
func (h *FinanceHandler) ApproveExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	expense, err := h.repo.ApproveExpense(c.Request.Context(), scope.PropertyID, id, scope.ActorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, expense)
}

// PayExpense records payment of an approved expense.
func (h *FinanceHandler) PayExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	var payload struct {
		PaymentMethod string `json:"payment_method"`
	}
	_ = c.ShouldBindJSON(&payload)

	expense, err := h.repo.PayExpense(c.Request.Context(), scope.PropertyID, id, scope.ActorID, payload.PaymentMethod)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, expense)
}

// DeleteExpense deletes draft/pending expense.
func (h *FinanceHandler) DeleteExpense(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid expense ID"})
		return
	}

	if err := h.repo.DeleteExpense(c.Request.Context(), scope.PropertyID, id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Expense deleted successfully"})
}

// ListPeriodClosures lists monthly closed periods.
func (h *FinanceHandler) ListPeriodClosures(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	closures, err := h.repo.ListPeriodClosures(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, closures)
}

// GetPeriodClosure returns single period closure with adjustments.
func (h *FinanceHandler) GetPeriodClosure(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	periodKey := c.Param("period_key")
	closure, err := h.repo.GetPeriodClosure(c.Request.Context(), scope.PropertyID, periodKey)
	if err != nil {
		if errors.Is(err, repository.ErrPeriodNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Period closure not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, closure)
}

// ClosePeriod closes and locks an accounting period (AC 4).
func (h *FinanceHandler) ClosePeriod(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	var req model.ClosePeriodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	closure, err := h.repo.ClosePeriod(c.Request.Context(), scope.PropertyID, scope.ActorID, req)
	if err != nil {
		if errors.Is(err, repository.ErrPeriodAlreadyClosed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, closure)
}

// ReopenPeriod reopens a closed period with audit reason.
func (h *FinanceHandler) ReopenPeriod(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	periodKey := c.Param("period_key")
	var req model.ReopenPeriodRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	closure, err := h.repo.ReopenPeriod(c.Request.Context(), scope.PropertyID, scope.ActorID, periodKey, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, closure)
}

// ListAdjustments lists adjustments for property or specific closure.
func (h *FinanceHandler) ListAdjustments(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	var periodCloseID *uuid.UUID
	if rawID := c.Query("period_close_id"); rawID != "" {
		if parsed, err := uuid.Parse(rawID); err == nil {
			periodCloseID = &parsed
		}
	}

	adjs, err := h.repo.ListAdjustments(c.Request.Context(), scope.PropertyID, periodCloseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, adjs)
}

// GetAdjustment returns single adjustment with its events audit trail.
func (h *FinanceHandler) GetAdjustment(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("adjustment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid adjustment ID"})
		return
	}

	adj, err := h.repo.GetAdjustmentByID(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		if errors.Is(err, repository.ErrAdjustmentNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Adjustment not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, adj)
}

// CreateAdjustment requests an adjustment for a closed period (AC 4).
func (h *FinanceHandler) CreateAdjustment(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	rawCloseID := c.Param("period_key")
	if rawCloseID == "" {
		rawCloseID = c.Param("period_close_id")
	}

	var req struct {
		PeriodCloseID  string `json:"period_close_id"`
		AdjustmentType string `json:"adjustment_type" binding:"required"`
		AmountMinor    int64  `json:"amount_minor" binding:"required"`
		Reason         string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if rawCloseID == "" {
		rawCloseID = req.PeriodCloseID
	}

	periodCloseID, err := uuid.Parse(rawCloseID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid period_close_id"})
		return
	}

	adjReq := model.CreatePeriodAdjustmentRequest{
		AdjustmentType: req.AdjustmentType,
		AmountMinor:    req.AmountMinor,
		Reason:         req.Reason,
	}

	adj, err := h.repo.CreateAdjustment(c.Request.Context(), scope.PropertyID, scope.ActorID, periodCloseID, adjReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, adj)
}

// ApproveAdjustment approves or rejects an adjustment with audit trail (AC 4).
func (h *FinanceHandler) ApproveAdjustment(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("adjustment_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid adjustment ID"})
		return
	}

	var req model.ApproveAdjustmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	adj, err := h.repo.ApproveAdjustment(c.Request.Context(), scope.PropertyID, id, scope.ActorID, req)
	if err != nil {
		if errors.Is(err, repository.ErrAdjustmentAlreadyProcessed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, adj)
}

// CreateExportJob creates a CSV report export job (AC 5).
func (h *FinanceHandler) CreateExportJob(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	var req model.CreateExportJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	job, err := h.repo.CreateExportJob(c.Request.Context(), scope.PropertyID, scope.ActorID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Dispatch export compilation job asynchronously to RabbitMQ
	if h.rabbitConn != nil && h.rabbitConn.IsConnected() {
		_ = rabbitmq.PublishDocumentJob(c.Request.Context(), h.rabbitConn, &rabbitmq.DocumentJob{
			JobID:         job.ID,
			PropertyID:    scope.PropertyID,
			Type:          "report_csv",
			RequestedBy:   scope.ActorID,
			CorrelationID: c.GetString("correlation_id"),
			Payload: map[string]interface{}{
				"report_type":   req.ReportType,
				"period_start":  req.PeriodStart,
				"period_end":    req.PeriodEnd,
				"export_format": req.ExportFormat,
			},
		})
	}

	c.JSON(http.StatusCreated, job)
}

// ListExportJobs lists export jobs for property.
func (h *FinanceHandler) ListExportJobs(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	jobs, err := h.repo.ListExportJobs(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, jobs)
}

// GetExportJob returns details for a single export job.
func (h *FinanceHandler) GetExportJob(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("job_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job ID"})
		return
	}

	job, err := h.repo.GetExportJob(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Export job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// DownloadExport directly downloads the CSV report.
func (h *FinanceHandler) DownloadExport(c *gin.Context) {
	scope, ok := financeScope(c)
	if !ok {
		return
	}

	id, err := uuid.Parse(c.Param("job_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid job ID"})
		return
	}

	job, err := h.repo.GetExportJob(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Export job not found"})
		return
	}

	c.Header("Content-Disposition", "attachment; filename="+job.FileName)
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("X-Checksum-SHA256", job.ChecksumSHA256)
	c.String(http.StatusOK, job.FileContent)
}
