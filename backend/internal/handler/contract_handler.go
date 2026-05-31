package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ContractHandler struct {
	repo *repository.ContractRepository
}

func NewContractHandler(repo *repository.ContractRepository) *ContractHandler {
	return &ContractHandler{repo: repo}
}

func (h *ContractHandler) CreateContract(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	ownerID, _ := uuid.Parse(userIDStr.(string))

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
	tenantID, err := uuid.Parse(req.TenantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid tenant ID"})
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

	contract := &model.Contract{
		RoomID:         &roomID,
		TenantID:       &tenantID,
		OwnerID:        ownerID,
		StartDate:      startDate,
		EndDate:        endDate,
		RentalDuration: req.RentalDuration,
		MonthlyRent:    req.MonthlyRent,
		TotalPrice:     req.MonthlyRent * float64(req.RentalDuration),
		Deposit:        req.Deposit,
		PaymentDueDay:  req.PaymentDueDay,
		Status:         "active",
		Notes:          req.Notes,
	}

	if err := h.repo.Create(c.Request.Context(), contract); err != nil {
		if strings.Contains(err.Error(), "kamar tidak tersedia") {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create contract"})
		return
	}

	c.JSON(http.StatusCreated, contract)
}

func (h *ContractHandler) GetContracts(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))
	status := c.Query("status")

	contracts, err := h.repo.FindAll(c.Request.Context(), ownerID, status)
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
	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	contract, err := h.repo.FindByID(c.Request.Context(), id, ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}

	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) UpdateContract(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))

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

	contract, err := h.repo.FindByID(c.Request.Context(), id, ownerID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	}

	if req.StartDate != "" {
		startDate, err := time.Parse("2006-01-02", req.StartDate)
		if err == nil {
			contract.StartDate = startDate
		}
	}
	if req.RentalDuration > 0 {
		contract.RentalDuration = req.RentalDuration
	}
	if req.EndDate != "" {
		endDate, err := time.Parse("2006-01-02", req.EndDate)
		if err == nil {
			contract.EndDate = endDate
		}
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
	if req.Status != "" {
		contract.Status = req.Status
	}
	if req.Notes != "" {
		contract.Notes = req.Notes
	}

	if err := h.repo.Update(c.Request.Context(), contract); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update contract"})
		return
	}

	c.JSON(http.StatusOK, contract)
}

func (h *ContractHandler) DeleteContract(c *gin.Context) {
	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id, ownerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete contract"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Contract deleted successfully"})
}
