package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type ContractHandler struct {
	repo      *repository.ContractRepository
	lifecycle *repository.ContractLifecycleRepository
	documents *service.ContractDocumentService
}

func NewContractHandler(repo *repository.ContractRepository, lifecycle *repository.ContractLifecycleRepository, documents *service.ContractDocumentService) *ContractHandler {
	return &ContractHandler{repo: repo, lifecycle: lifecycle, documents: documents}
}

func (h *ContractHandler) CreateContract(c *gin.Context) {
	scope, exists := middleware.GetPropertyScope(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req model.CreateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	roomID, err := uuid.Parse(req.RoomID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid room ID"})
		return
	}
	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date format, expected YYYY-MM-DD"})
		return
	}
	endDate, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date format, expected YYYY-MM-DD"})
		return
	}
	if endDate.Before(startDate) || req.RentalDuration <= 0 || req.MonthlyRent <= 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tanggal, durasi, dan harga kontrak tidak valid"})
		return
	}
	if req.PaymentDueDay == 0 {
		req.PaymentDueDay = startDate.Day()
	}
	if req.PaymentDueDay < 1 || req.PaymentDueDay > 31 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tanggal jatuh tempo harus 1 sampai 31"})
		return
	}
	if req.PaymentInterval == "" {
		req.PaymentInterval = "monthly"
	}
	if req.PaymentInterval != "monthly" && req.PaymentInterval != "per_contract" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Interval pembayaran tidak didukung"})
		return
	}

	contract := &model.Contract{
		PropertyID:      scope.PropertyID,
		RoomID:          &roomID,
		UserID:          &userID,
		OwnerID:         scope.ActorID,
		StartDate:       startDate,
		EndDate:         endDate,
		RentalDuration:  req.RentalDuration,
		MonthlyRent:     req.MonthlyRent,
		TotalPrice:      (req.MonthlyRent * float64(req.RentalDuration)) + req.Deposit,
		Deposit:         req.Deposit,
		PaymentInterval: req.PaymentInterval,
		PaymentDueDay:   req.PaymentDueDay,
		Status:          model.ContractDraft,
		Notes:           req.Notes,
	}

	if err := h.repo.Create(c.Request.Context(), scope.PropertyID, scope.ActorID, contract); err != nil {
		if strings.Contains(err.Error(), "kamar tidak tersedia") {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Room or tenant not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create contract"})
		return
	}

	c.JSON(http.StatusCreated, contract)
}

func (h *ContractHandler) GetContracts(c *gin.Context) {
	scope, exists := middleware.GetPropertyScope(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	status := c.Query("status")

	contracts, err := h.repo.FindAll(c.Request.Context(), scope.PropertyID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch contracts"})
		return
	}

	if contracts == nil {
		contracts = []model.Contract{}
	}

	c.JSON(http.StatusOK, contracts)
}

func (h *ContractHandler) GetContract(c *gin.Context) {
	scope, exists := middleware.GetPropertyScope(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	contract, err := h.lifecycle.Detail(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}

	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) TransitionContract(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	var req model.ContractTransitionRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var effective *time.Time
	if strings.TrimSpace(req.EffectiveDate) != "" {
		parsed, parseErr := time.Parse("2006-01-02", req.EffectiveDate)
		if parseErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid effective_date format, expected YYYY-MM-DD"})
			return
		}
		effective = &parsed
	}
	err = h.lifecycle.Transition(c.Request.Context(), scope.PropertyID, scope.ActorID, id, req.ToStatus, req.Reason, effective)
	if err != nil {
		writeContractLifecycleError(c, err)
		return
	}
	detail, err := h.lifecycle.Detail(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": req.ToStatus})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *ContractHandler) AcceptContract(c *gin.Context) {
	actorValue, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	actorID, err := uuid.Parse(fmt.Sprint(actorValue))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	var req struct {
		PolicyAccepted bool `json:"policy_accepted"`
	}
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid acceptance request"})
		return
	}
	if !req.PolicyAccepted {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Persetujuan kontrak dan aturan properti wajib diberikan"})
		return
	}
	if err = h.lifecycle.AcceptByTenant(c.Request.Context(), actorID, id, c.ClientIP(), c.GetHeader("User-Agent")); err != nil {
		writeContractLifecycleError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Kontrak disetujui dan dijadwalkan"})
}

func (h *ContractHandler) ReviewContract(c *gin.Context) {
	actorValue, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	actorID, err := uuid.Parse(fmt.Sprint(actorValue))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	propertyID, err := h.lifecycle.TenantContract(c.Request.Context(), actorID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}
	detail, err := h.lifecycle.Detail(c.Request.Context(), propertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}
	c.JSON(http.StatusOK, detail)
}

func (h *ContractHandler) AmendContract(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	var req model.ContractAmendRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	contract, err := h.repo.FindByID(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}
	if req.StartDate != "" {
		contract.StartDate, err = time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date"})
			return
		}
	}
	if req.EndDate != "" {
		contract.EndDate, err = time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date"})
			return
		}
	}
	if req.MonthlyRent != nil {
		contract.MonthlyRent = *req.MonthlyRent
	}
	if req.Deposit != nil {
		contract.Deposit = *req.Deposit
	}
	if req.PaymentInterval != "" {
		contract.PaymentInterval = req.PaymentInterval
	}
	if req.PaymentDueDay != nil {
		contract.PaymentDueDay = *req.PaymentDueDay
	}
	if req.Notes != nil {
		contract.Notes = *req.Notes
	}
	contract.RentalDuration = monthDuration(contract.StartDate, contract.EndDate)
	contract.TotalPrice = calculateContractTotal(contract)
	if err = h.lifecycle.Amend(c.Request.Context(), scope.PropertyID, scope.ActorID, contract, req.Reason); err != nil {
		writeContractLifecycleError(c, err)
		return
	}
	detail, _ := h.lifecycle.Detail(c.Request.Context(), scope.PropertyID, id)
	c.JSON(http.StatusOK, detail)
}

func (h *ContractHandler) RenewContract(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	var req model.ContractRenewRequest
	if err = c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	start, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date"})
		return
	}
	end, err := time.Parse("2006-01-02", req.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date"})
		return
	}
	duration := monthDuration(start, end)
	if req.PaymentInterval == "" {
		req.PaymentInterval = "monthly"
	}
	if req.PaymentDueDay == 0 {
		req.PaymentDueDay = start.Day()
	}
	child := &model.Contract{StartDate: start, EndDate: end, RentalDuration: duration, MonthlyRent: req.MonthlyRent, Deposit: req.Deposit, PaymentInterval: req.PaymentInterval, PaymentDueDay: req.PaymentDueDay, Notes: req.Notes}
	child.TotalPrice = calculateContractTotal(child)
	if err = h.lifecycle.Renew(c.Request.Context(), scope.PropertyID, scope.ActorID, id, child, req.Reason); err != nil {
		writeContractLifecycleError(c, err)
		return
	}
	c.JSON(http.StatusCreated, child)
}

func (h *ContractHandler) PublishContractDocument(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	version, contract, err := h.lifecycle.CurrentSnapshot(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract snapshot not found"})
		return
	}
	content, hash, err := h.documents.Generate(*version, *contract)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate contract document"})
		return
	}
	name := fmt.Sprintf("kontrak-%s-v%d.pdf", contract.ID.String(), version.VersionNumber)
	document, err := h.lifecycle.SaveDocument(c.Request.Context(), scope.PropertyID, id, version.ID, scope.ActorID, version.VersionNumber, name, hash, content)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Document for this version is already published"})
		return
	}
	c.JSON(http.StatusCreated, document)
}

func (h *ContractHandler) DownloadContractDocument(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	contractID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	documentID, err := uuid.Parse(c.Param("document_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}
	name, mime, content, err := h.lifecycle.DocumentContent(c.Request.Context(), scope.PropertyID, contractID, documentID, scope.ActorID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	writeContractDocument(c, name, mime, content)
}

func (h *ContractHandler) DownloadTenantContractDocument(c *gin.Context) {
	actorValue, ok := c.Get("user_id")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	actorID, err := uuid.Parse(fmt.Sprint(actorValue))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	contractID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}
	documentID, err := uuid.Parse(c.Param("document_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid document ID"})
		return
	}
	propertyID, err := h.lifecycle.TenantContract(c.Request.Context(), actorID, contractID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	name, mime, content, err := h.lifecycle.DocumentContent(c.Request.Context(), propertyID, contractID, documentID, actorID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}
	writeContractDocument(c, name, mime, content)
}

func writeContractDocument(c *gin.Context, name, mime string, content []byte) {
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	c.Data(http.StatusOK, mime, content)
}

func writeContractLifecycleError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
	case errors.Is(err, repository.ErrIllegalContractTransition), errors.Is(err, repository.ErrContractPrerequisite), errors.Is(err, repository.ErrContractHistoryImmutable):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Contract lifecycle operation failed"})
	}
}

func monthDuration(start, end time.Time) int {
	months := (end.Year()-start.Year())*12 + int(end.Month()-start.Month())
	if months < 1 {
		months = 1
	}
	return months
}

func calculateContractTotal(contract *model.Contract) float64 {
	return (contract.MonthlyRent+contract.ElectricityBill+contract.WaterBill+contract.OtherBills)*float64(contract.RentalDuration) + contract.Deposit
}

func (h *ContractHandler) UpdateContract(c *gin.Context) {
	scope, exists := middleware.GetPropertyScope(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	var req model.UpdateContractRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	contract, err := h.repo.FindByID(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}

	if req.StartDate != "" {
		startDate, err := time.Parse("2006-01-02", req.StartDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start_date"})
			return
		}
		contract.StartDate = startDate
	}
	if req.RentalDuration > 0 {
		contract.RentalDuration = req.RentalDuration
	}
	if req.EndDate != "" {
		endDate, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end_date"})
			return
		}
		contract.EndDate = endDate
	}
	if req.MonthlyRent > 0 {
		contract.MonthlyRent = req.MonthlyRent
	}
	if req.Deposit >= 0 {
		contract.Deposit = req.Deposit
	}
	if req.PaymentDueDay > 0 {
		contract.PaymentDueDay = req.PaymentDueDay
	}
	if req.PaymentInterval != "" {
		if req.PaymentInterval != "monthly" && req.PaymentInterval != "per_contract" {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Interval pembayaran tidak didukung"})
			return
		}
		contract.PaymentInterval = req.PaymentInterval
	}
	if req.Status != "" && req.Status != contract.Status {
		c.JSON(http.StatusConflict, gin.H{"error": "Gunakan endpoint transition untuk mengubah status kontrak"})
		return
	}
	if req.Notes != "" {
		contract.Notes = req.Notes
	}

	contract.RentalDuration = monthDuration(contract.StartDate, contract.EndDate)
	contract.TotalPrice = calculateContractTotal(contract)
	if err := h.lifecycle.Amend(c.Request.Context(), scope.PropertyID, scope.ActorID, contract, "Pembaruan melalui endpoint kompatibilitas"); err != nil {
		writeContractLifecycleError(c, err)
		return
	}

	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) DeleteContract(c *gin.Context) {
	scope, exists := middleware.GetPropertyScope(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	contract, err := h.repo.FindByID(c.Request.Context(), scope.PropertyID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}
	if contract.Status != model.ContractDraft && contract.Status != model.ContractPendingTenant && contract.Status != model.ContractScheduled {
		c.JSON(http.StatusConflict, gin.H{"error": "Kontrak berhistori tidak boleh dihapus; gunakan termination atau end"})
		return
	}
	if err := h.lifecycle.Transition(c.Request.Context(), scope.PropertyID, scope.ActorID, id, model.ContractCancelled, "Dibatalkan melalui endpoint kompatibilitas", nil); err != nil {
		writeContractLifecycleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contract cancelled successfully"})
}
