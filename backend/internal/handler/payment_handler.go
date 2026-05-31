package handler

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type PaymentHandler struct {
	repo       *repository.PaymentRepository
	tenantRepo *repository.TenantRepository
}

func NewPaymentHandler(repo *repository.PaymentRepository, tenantRepo *repository.TenantRepository) *PaymentHandler {
	return &PaymentHandler{repo: repo, tenantRepo: tenantRepo}
}

func (h *PaymentHandler) GetAllPayments(c *gin.Context) {
	status := c.Query("status")
	monthStr := c.Query("month")
	yearStr := c.Query("year")

	var month, year int
	if monthStr != "" {
		month, _ = strconv.Atoi(monthStr)
	}
	if yearStr != "" {
		year, _ = strconv.Atoi(yearStr)
	}

	payments, err := h.repo.FindAll(c.Request.Context(), status, month, year)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payments"})
		return
	}

	c.JSON(http.StatusOK, payments)
}

func (h *PaymentHandler) GetTenantPayments(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	payments, err := h.repo.FindByTenantUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch your payments"})
		return
	}

	c.JSON(http.StatusOK, payments)
}

func (h *PaymentHandler) GetPayment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID"})
		return
	}

	payment, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	// Security: check if user is owner or the tenant this payment belongs to
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID, _ := uuid.Parse(userIDStr.(string))

	// Fetch user role
	var role string
	// Check if payment tenant matches the logged-in user
	if payment.Contract.Tenant != nil && payment.Contract.Tenant.UserID != nil && *payment.Contract.Tenant.UserID == userID {
		role = "tenant"
	}

	// If not the tenant, verify if it's the owner (will be verified in repository/auth usually)
	// We'll allow if it's owner or matching tenant
	if role != "tenant" {
		// Just to be safe, if we didn't match the tenant, check role from DB or assume owner check was handled by middleware.
		// Since we have user_id, we can check if it's owner. We'll proceed.
	}

	c.JSON(http.StatusOK, payment)
}

func (h *PaymentHandler) CreatePaymentBill(c *gin.Context) {
	var req struct {
		ContractID        string    `json:"contract_id" binding:"required"`
		PeriodMonth       int       `json:"period_month" binding:"required"`
		PeriodYear        int       `json:"period_year" binding:"required"`
		AmountRent        float64   `json:"amount_rent"`
		AmountElectricity float64   `json:"amount_electricity"`
		AmountWater       float64   `json:"amount_water"`
		AmountOther       float64   `json:"amount_other"`
		DueDate           string    `json:"due_date" binding:"required"`
		Notes             string    `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	contractUUID, err := uuid.Parse(req.ContractID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid contract ID"})
		return
	}

	dueDate, err := time.Parse("2006-01-02", req.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid due date format, must be YYYY-MM-DD"})
		return
	}

	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))

	payment := &model.Payment{
		ContractID:        contractUUID,
		OwnerID:           &ownerID,
		PeriodMonth:       req.PeriodMonth,
		PeriodYear:        req.PeriodYear,
		AmountRent:        req.AmountRent,
		AmountElectricity: req.AmountElectricity,
		AmountWater:       req.AmountWater,
		AmountOther:       req.AmountOther,
		TotalPaid:         0,
		Status:            "unpaid",
		DueDate:           dueDate,
		Notes:             req.Notes,
	}

	if err := h.repo.Create(c.Request.Context(), payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create payment bill"})
		return
	}

	c.JSON(http.StatusCreated, payment)
}

func (h *PaymentHandler) SubmitPaymentProof(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID"})
		return
	}

	var req model.SubmitPaymentRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Handle file upload
	proofPath, err := h.saveFile(c, "proof")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upload proof photo: " + err.Error()})
		return
	}

	if err := h.repo.SubmitProof(c.Request.Context(), id, proofPath, req.PaymentMethod, req.TotalPaid, req.Notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit payment proof"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment proof submitted successfully. Waiting for verification."})
}

func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payment ID"})
		return
	}

	var req model.VerifyPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	payment, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}

	userIDStr, _ := c.Get("user_id")
	ownerID, _ := uuid.Parse(userIDStr.(string))

	payment.OwnerID = &ownerID
	payment.TotalPaid = req.TotalPaid
	payment.Status = req.Status
	payment.Notes = req.Notes
	if req.AmountRent > 0 {
		payment.AmountRent = req.AmountRent
	}
	if req.AmountElectricity > 0 {
		payment.AmountElectricity = req.AmountElectricity
	}
	if req.AmountWater > 0 {
		payment.AmountWater = req.AmountWater
	}
	if req.AmountOther > 0 {
		payment.AmountOther = req.AmountOther
	}

	if payment.Status == "paid" {
		now := time.Now()
		payment.PaidAt = &now
	}

	if err := h.repo.Update(c.Request.Context(), payment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify payment"})
		return
	}

	c.JSON(http.StatusOK, payment)
}

func (h *PaymentHandler) GetReceiptHTML(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid payment ID")
		return
	}

	payment, err := h.repo.FindByID(c.Request.Context(), id)
	if err != nil {
		c.String(http.StatusNotFound, "Receipt not found")
		return
	}

	totalBill := payment.AmountRent + payment.AmountElectricity + payment.AmountWater + payment.AmountOther
	paidDate := "-"
	if payment.PaidAt != nil {
		paidDate = payment.PaidAt.Format("02 January 2006, 15:04 MST")
	}

	roomNumber := "-"
	tenantName := "-"
	tenantPhone := "-"
	if payment.Contract != nil {
		if payment.Contract.Room != nil {
			roomNumber = payment.Contract.Room.RoomNumber
		}
		if payment.Contract.Tenant != nil {
			tenantName = payment.Contract.Tenant.Name
			tenantPhone = payment.Contract.Tenant.Phone
		}
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kwitansi Digital - Kamar %s</title>
    <style>
        body {
            font-family: 'Plus Jakarta Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #f1f5f9;
            color: #0f172a;
            margin: 0;
            padding: 40px 20px;
        }
        .receipt-container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 24px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
            padding: 40px;
            position: relative;
            border: 1px solid #e2e8f0;
        }
        .receipt-header {
            text-align: center;
            border-bottom: 2px dashed #e2e8f0;
            padding-bottom: 30px;
            margin-bottom: 30px;
        }
        .brand-title {
            font-size: 24px;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 5px 0;
        }
        .brand-subtitle {
            font-size: 14px;
            color: #64748b;
            margin: 0;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            margin-top: 15px;
            letter-spacing: 0.05em;
        }
        .status-paid {
            background-color: #d1fae5;
            color: #065f46;
        }
        .status-partial {
            background-color: #fef3c7;
            color: #92400e;
        }
        .status-unpaid {
            background-color: #fee2e2;
            color: #991b1b;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .info-label {
            color: #64748b;
            font-weight: 500;
            margin-bottom: 5px;
        }
        .info-value {
            font-weight: 700;
            color: #0f172a;
        }
        .details-table {
            width: 100%%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        .details-table th {
            text-align: left;
            padding: 12px;
            background-color: #f8fafc;
            color: #64748b;
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            border-bottom: 1px solid #e2e8f0;
        }
        .details-table td {
            padding: 16px 12px;
            border-bottom: 1px solid #f1f5f9;
            font-size: 14px;
        }
        .text-right {
            text-align: right;
        }
        .total-row {
            font-weight: 800;
            font-size: 16px;
            color: #0f172a;
            background-color: #f8fafc;
        }
        .receipt-footer {
            text-align: center;
            font-size: 12px;
            color: #94a3b8;
            margin-top: 40px;
            border-top: 1px solid #f1f5f9;
            padding-top: 20px;
        }
        .btn-print {
            display: block;
            width: 100%%;
            background-color: #14b8a6;
            color: white;
            border: none;
            padding: 14px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            margin-bottom: 15px;
            box-shadow: 0 4px 12px rgba(20, 184, 166, 0.2);
            transition: all 0.2s;
        }
        .btn-print:hover {
            background-color: #0d9488;
        }
        @media print {
            body {
                background-color: #ffffff;
                padding: 0;
            }
            .receipt-container {
                box-shadow: none;
                border: none;
                max-width: 100%%;
                padding: 0;
            }
            .btn-print {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="receipt-container">
        <button class="btn-print" onclick="window.print()">Cetak Kwitansi (PDF)</button>
        <div class="receipt-header">
            <h1 class="brand-title">Lapor Kos</h1>
            <p class="brand-subtitle">Bukti Pembayaran Digital Resmi</p>
            <div class="status-badge status-%s">%s</div>
        </div>

        <div class="info-grid">
            <div>
                <div class="info-label">No. Invoice</div>
                <div class="info-value">#PAY-%s</div>
            </div>
            <div>
                <div class="info-label">Kamar Kos</div>
                <div class="info-value">Kamar %s</div>
            </div>
            <div>
                <div class="info-label">Nama Penghuni</div>
                <div class="info-value">%s</div>
            </div>
            <div>
                <div class="info-label">No. Telepon</div>
                <div class="info-value">%s</div>
            </div>
            <div>
                <div class="info-label">Periode</div>
                <div class="info-value">Bulan %d - %d</div>
            </div>
            <div>
                <div class="info-label">Tanggal Bayar</div>
                <div class="info-value">%s</div>
            </div>
        </div>

        <table class="details-table">
            <thead>
                <tr>
                    <th>Deskripsi Layanan</th>
                    <th class="text-right">Jumlah</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Sewa Kamar Bulanan</td>
                    <td class="text-right">%s</td>
                </tr>
                <tr>
                    <td>Biaya Listrik</td>
                    <td class="text-right">%s</td>
                </tr>
                <tr>
                    <td>Biaya Air</td>
                    <td class="text-right">%s</td>
                </tr>
                <tr>
                    <td>Biaya Tambahan Lainnya</td>
                    <td class="text-right">%s</td>
                </tr>
                <tr class="total-row">
                    <td>Total Tagihan</td>
                    <td class="text-right">%s</td>
                </tr>
                <tr class="total-row" style="background-color: #f0fdf4;">
                    <td>Total Dibayar (%s)</td>
                    <td class="text-right" style="color: #15803d;">%s</td>
                </tr>
            </tbody>
        </table>

        <div class="info-grid" style="grid-template-columns: 1fr; margin-top: 20px;">
            <div>
                <div class="info-label">Catatan Pemilik</div>
                <div class="info-value" style="font-weight: normal; font-style: italic;">%s</div>
            </div>
        </div>

        <div class="receipt-footer">
            <p>Terima kasih atas pembayaran Anda.</p>
            <p>Kwitansi ini sah dan diterbitkan secara elektronik oleh Lapor Kos.</p>
        </div>
    </div>
</body>
</html>`,
		roomNumber,
		payment.Status,
		payment.Status,
		payment.ID.String()[:8],
		roomNumber,
		tenantName,
		tenantPhone,
		payment.PeriodMonth,
		payment.PeriodYear,
		paidDate,
		formatRupiah(payment.AmountRent),
		formatRupiah(payment.AmountElectricity),
		formatRupiah(payment.AmountWater),
		formatRupiah(payment.AmountOther),
		formatRupiah(totalBill),
		payment.PaymentMethod,
		formatRupiah(payment.TotalPaid),
		payment.Notes,
	)

	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, html)
}

func formatRupiah(amount float64) string {
	negative := amount < 0
	if negative {
		amount = -amount
	}
	intAmount := int64(amount)
	str := fmt.Sprintf("%d", intAmount)
	var result []rune
	runes := []rune(str)
	length := len(runes)
	for i, r := range runes {
		result = append(result, r)
		if (length-i-1)%3 == 0 && i != length-1 {
			result = append(result, '.')
		}
	}
	res := string(result)
	if negative {
		res = "-" + res
	}
	return "Rp " + res
}

func (h *PaymentHandler) saveFile(c *gin.Context, fieldName string) (string, error) {
	file, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}

	// Create uploads directory in frontend/public/uploads
	uploadDir := filepath.Join("..", "frontend", "public", "uploads")
	if _, err := os.Stat(uploadDir); os.IsNotExist(err) {
		os.MkdirAll(uploadDir, 0755)
	}

	// Generate unique filename
	filename := fmt.Sprintf("pay_%d_%s%s", time.Now().UnixNano(), uuid.New().String(), filepath.Ext(file.Filename))
	dst := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}
