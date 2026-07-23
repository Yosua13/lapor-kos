package handler

import (
	"context"
	"errors"
	"fmt"
	"html"
	"net/http"
	"strconv"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type PaymentHandler struct {
	repo           paymentRepository
	storageService *service.StorageService
	userRepo       repository.UserRepo
}

type paymentRepository interface {
	Create(context.Context, *model.Payment) error
	FindByID(context.Context, uuid.UUID, uuid.UUID) (*model.Payment, error)
	FindByIDForUser(context.Context, uuid.UUID, uuid.UUID) (*model.Payment, error)
	FindAll(context.Context, uuid.UUID, string, int, int, string, string) ([]model.Payment, error)
	FindByUserID(context.Context, uuid.UUID) ([]model.Payment, error)
	Update(context.Context, uuid.UUID, *model.Payment) (*model.Payment, error)
	SubmitProof(context.Context, uuid.UUID, uuid.UUID, string, string, float64, string) error
}

func NewPaymentHandler(repo paymentRepository, storageService *service.StorageService, userRepo ...repository.UserRepo) *PaymentHandler {
	handler := &PaymentHandler{repo: repo, storageService: storageService}
	if len(userRepo) > 0 {
		handler.userRepo = userRepo[0]
	}
	return handler
}

func (h *PaymentHandler) GetAllPayments(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	status := c.Query("status")
	monthStr := c.Query("month")
	yearStr := c.Query("year")
	contractID := c.Query("contract_id")
	userID := c.Query("user_id")

	var month, year int
	if monthStr != "" {
		month, _ = strconv.Atoi(monthStr)
	}
	if yearStr != "" {
		year, _ = strconv.Atoi(yearStr)
	}

	payments, err := h.repo.FindAll(c.Request.Context(), scope.PropertyID, status, month, year, contractID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payments"})
		return
	}

	c.JSON(http.StatusOK, payments)
}

func (h *PaymentHandler) GetTenantPayments(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	payments, err := h.repo.FindByUserID(c.Request.Context(), userID)
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

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var payment *model.Payment
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		payment, err = h.repo.FindByID(c.Request.Context(), id, scope.PropertyID)
	} else {
		payment, err = h.repo.FindByIDForUser(c.Request.Context(), id, userID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payment"})
		return
	}

	c.JSON(http.StatusOK, payment)
}

func (h *PaymentHandler) CreatePaymentBill(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	var req struct {
		ContractID        string  `json:"contract_id" binding:"required"`
		PeriodMonth       int     `json:"period_month" binding:"required"`
		PeriodYear        int     `json:"period_year" binding:"required"`
		AmountRent        float64 `json:"amount_rent"`
		AmountElectricity float64 `json:"amount_electricity"`
		AmountWater       float64 `json:"amount_water"`
		AmountOther       float64 `json:"amount_other"`
		DueDate           string  `json:"due_date" binding:"required"`
		Notes             string  `json:"notes"`
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

	payment := &model.Payment{
		PropertyID:        scope.PropertyID,
		ContractID:        contractUUID,
		OwnerID:           &scope.ActorID,
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

	if err := h.repo.Create(c.Request.Context(), payment); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Contract not found"})
		return
	} else if err != nil {
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

	userID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	// Authorize before uploading so a guessed foreign payment UUID cannot be
	// used to create orphaned storage objects.
	payment, err := h.repo.FindByIDForUser(c.Request.Context(), id, userID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to authorize payment"})
		return
	}

	// Handle file upload to Supabase Storage
	proofPath, err := h.uploadFile(c, "proof", payment.PropertyID, "payment-proof")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to upload proof photo: " + err.Error()})
		return
	}

	if err := h.repo.SubmitProof(c.Request.Context(), id, userID, proofPath, req.PaymentMethod, req.TotalPaid, req.Notes); errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to submit payment proof"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment proof submitted successfully. Waiting for verification."})
}

func (h *PaymentHandler) VerifyPayment(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

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

	payment, err := h.repo.FindByID(c.Request.Context(), id, scope.PropertyID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch payment"})
		return
	}

	payment.OwnerID = &scope.ActorID
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

	updatedPayment, err := h.repo.Update(c.Request.Context(), scope.PropertyID, payment)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Payment not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify payment"})
		return
	}

	c.JSON(http.StatusOK, updatedPayment)
}

func (h *PaymentHandler) GetReceiptHTML(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.String(http.StatusBadRequest, "Invalid payment ID")
		return
	}

	userID, ok := currentUserID(c)
	if !ok {
		c.String(http.StatusUnauthorized, "Unauthorized")
		return
	}
	var payment *model.Payment
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		payment, err = h.repo.FindByID(c.Request.Context(), id, scope.PropertyID)
	} else {
		payment, err = h.repo.FindByIDForUser(c.Request.Context(), id, userID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		c.String(http.StatusNotFound, "Receipt not found")
		return
	}
	if err != nil {
		c.String(http.StatusInternalServerError, "Failed to fetch receipt")
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
		if payment.Contract.User != nil {
			tenantName = payment.Contract.User.Name
			tenantPhone = payment.Contract.User.Phone
		}
	}

	depositVal := 0.0
	if payment.Contract != nil {
		depositVal = payment.Contract.Deposit
	}
	hasDeposit := depositVal > 0 && payment.AmountOther >= depositVal
	displayOther := payment.AmountOther
	if hasDeposit {
		displayOther = payment.AmountOther - depositVal
	}

	tableRows := fmt.Sprintf(`
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
                </tr>`,
		formatRupiah(payment.AmountRent),
		formatRupiah(payment.AmountElectricity),
		formatRupiah(payment.AmountWater),
		formatRupiah(displayOther),
	)

	if hasDeposit {
		tableRows += fmt.Sprintf(`
                <tr>
                    <td>Uang Jaminan (Deposito)</td>
                    <td class="text-right">%s</td>
                </tr>`,
			formatRupiah(depositVal),
		)
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
                %s
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
		html.EscapeString(roomNumber),
		html.EscapeString(payment.Status),
		html.EscapeString(payment.Status),
		payment.ID.String()[:8],
		html.EscapeString(roomNumber),
		html.EscapeString(tenantName),
		html.EscapeString(tenantPhone),
		payment.PeriodMonth,
		payment.PeriodYear,
		html.EscapeString(paidDate),
		tableRows,
		formatRupiah(totalBill),
		html.EscapeString(payment.PaymentMethod),
		formatRupiah(payment.TotalPaid),
		html.EscapeString(payment.Notes),
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

// uploadFile stores a proof in the private namespace of its contract property.
func (h *PaymentHandler) uploadFile(c *gin.Context, fieldName string, propertyID uuid.UUID, prefix string) (string, error) {
	fileHeader, err := c.FormFile(fieldName)
	if err != nil {
		return "", err
	}
	return h.storageService.UploadPropertyFile(fileHeader, propertyID, prefix)
}

func currentUserID(c *gin.Context) (uuid.UUID, bool) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		return uuid.Nil, false
	}
	return userID, true
}
