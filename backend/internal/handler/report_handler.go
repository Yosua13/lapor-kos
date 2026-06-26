package handler

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ReportHandler struct {
	paymentRepo *repository.PaymentRepository
	userRepo    repository.UserRepo
	pdfService  *service.ReportPDFService
}

func NewReportHandler(paymentRepo *repository.PaymentRepository, userRepo repository.UserRepo, pdfService *service.ReportPDFService) *ReportHandler {
	return &ReportHandler{
		paymentRepo: paymentRepo,
		userRepo:    userRepo,
		pdfService:  pdfService,
	}
}

func (h *ReportHandler) GetFinancialReportPDF(c *gin.Context) {
	month := parsePositiveInt(c.Query("month"))
	year := parsePositiveInt(c.Query("year"))

	payments, err := h.paymentRepo.FindAll(c.Request.Context(), "", month, year, "", "")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch report payments"})
		return
	}

	ownerName := "Pemilik Kos"
	if userIDStr, exists := c.Get("user_id"); exists {
		if userID, parseErr := uuid.Parse(userIDStr.(string)); parseErr == nil {
			if user, findErr := h.userRepo.FindByID(c.Request.Context(), userID); findErr == nil {
				ownerName = user.Name
			}
		}
	}

	pdfBytes, err := h.pdfService.GenerateFinancialReport(service.FinancialReportPDFData{
		Payments:  payments,
		OwnerName: ownerName,
		Month:     month,
		Year:      year,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate financial report PDF"})
		return
	}

	fileName := "laporan-keuangan-lapor-kos"
	if year > 0 {
		fileName = fmt.Sprintf("%s-%d", fileName, year)
	}
	if month > 0 {
		fileName = fmt.Sprintf("%s-%02d", fileName, month)
	}

	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s.pdf"`, fileName))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func parsePositiveInt(value string) int {
	if value == "" || value == "all" {
		return 0
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0
	}
	return parsed
}
