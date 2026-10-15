package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type VisitorPermitHandler struct {
	repo *repository.VisitorPermitRepository
}

func NewVisitorPermitHandler(repo *repository.VisitorPermitRepository) *VisitorPermitHandler {
	return &VisitorPermitHandler{repo: repo}
}

func parseActorUserID(c *gin.Context) (uuid.UUID, error) {
	val, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("unauthorized: missing user_id")
	}
	switch v := val.(type) {
	case uuid.UUID:
		return v, nil
	case string:
		return uuid.Parse(strings.TrimSpace(v))
	default:
		return uuid.Nil, fmt.Errorf("unexpected user_id type: %T", val)
	}
}

func parseDateTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.ParseInLocation(f, s, time.Local); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("format tanggal/waktu tidak valid: %s", s)
}

// TenantCreatePermit handles tenant submission for guest/visitor permit.
// Enforces Acceptance Criteria 1 (Active occupancy only) & 2 (Lease end & house rules validation).
func (h *VisitorPermitHandler) TenantCreatePermit(c *gin.Context) {
	tenantID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	var req model.CreateVisitorPermitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Data input tidak lengkap atau tidak valid: " + err.Error()})
		return
	}

	req.GuestName = strings.TrimSpace(req.GuestName)
	if req.GuestName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nama tamu wajib diisi"})
		return
	}

	startTime, err := parseDateTime(req.StartTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu mulai tidak valid: " + err.Error()})
		return
	}

	endTime, err := parseDateTime(req.EndTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu selesai tidak valid: " + err.Error()})
		return
	}

	if !endTime.After(startTime) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Waktu selesai harus lebih besar dari waktu mulai kunjungan"})
		return
	}

	// 1. Verify active occupancy (AC 1)
	var activeContract *model.Contract
	propertyIDHeader := strings.TrimSpace(c.GetHeader("X-Property-ID"))
	if propertyIDHeader != "" {
		if pid, err := uuid.Parse(propertyIDHeader); err == nil {
			activeContract, err = h.repo.GetActiveContractForTenant(c.Request.Context(), pid, tenantID)
		}
	}
	if activeContract == nil {
		activeContract, err = h.repo.FindActiveContractAnyProperty(c.Request.Context(), tenantID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Tenant hanya dapat mengajukan izin tamu untuk hunian/kontrak aktif miliknya. Tidak ditemukan kontrak aktif.",
			})
			return
		}
	}

	if activeContract.RoomID == nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Kontrak aktif tidak memiliki kamar yang terkait.",
		})
		return
	}

	// 2. Validate against Lease End Date (AC 2)
	// Contract EndDate is considered valid until 23:59:59 of that day
	contractEndLimit := time.Date(
		activeContract.EndDate.Year(), activeContract.EndDate.Month(), activeContract.EndDate.Day(),
		23, 59, 59, 999999999, activeContract.EndDate.Location(),
	)
	if endTime.After(contractEndLimit) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf(
				"Waktu izin tamu melewati batas akhir kontrak sewa Anda (%s). Pengajuan ditolak.",
				activeContract.EndDate.Format("02 Jan 2006"),
			),
		})
		return
	}

	contractStartLimit := time.Date(
		activeContract.StartDate.Year(), activeContract.StartDate.Month(), activeContract.StartDate.Day(),
		0, 0, 0, 0, activeContract.StartDate.Location(),
	)
	if startTime.Before(contractStartLimit) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf(
				"Waktu izin tamu sebelum awal masa berlaku kontrak sewa Anda (%s). Pengajuan ditolak.",
				activeContract.StartDate.Format("02 Jan 2006"),
			),
		})
		return
	}

	// 3. House Rules Validations (AC 2)
	if req.IsOvernight {
		// Maximum 3 consecutive days for overnight stay
		stayDuration := endTime.Sub(startTime)
		if stayDuration > (73 * time.Hour) {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Durasi menginap tamu melebihi batas maksimal 3 hari berturut-turut sesuai peraturan kos.",
			})
			return
		}
	} else {
		// Non-overnight visitors: must finish by 22:00 WIB
		if endTime.Hour() > 22 || (endTime.Hour() == 22 && endTime.Minute() > 0) || endTime.Day() != startTime.Day() {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Kunjungan tamu tanpa menginap maksimal hingga pukul 22:00 WIB di hari yang sama. Silakan pilih opsi 'Menginap' jika tamu bermaksud lewat pukul 22:00.",
			})
			return
		}
	}

	// Total guests validation
	totalGuests := req.TotalGuests
	if totalGuests <= 0 {
		totalGuests = 1
	}
	if totalGuests > 3 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Maksimal kapasitas tamu per izin adalah 3 orang demi kenyamanan bersama.",
		})
		return
	}

	vehicleType := strings.TrimSpace(req.VehicleType)
	if vehicleType == "" {
		vehicleType = "tidak_ada"
	}
	switch vehicleType {
	case "tidak_ada", "motor", "mobil", "lainnya":
	default:
		vehicleType = "lainnya"
	}

	var vehicleNumber *string
	if strings.TrimSpace(req.VehicleNumber) != "" {
		v := strings.TrimSpace(req.VehicleNumber)
		vehicleNumber = &v
	}

	var guestPhone *string
	if strings.TrimSpace(req.GuestPhone) != "" {
		p := strings.TrimSpace(req.GuestPhone)
		guestPhone = &p
	}

	var guestIDCardLast4 *string
	if strings.TrimSpace(req.GuestIDCardLast4) != "" {
		idLast4 := strings.TrimSpace(req.GuestIDCardLast4)
		if len(idLast4) > 4 {
			idLast4 = idLast4[len(idLast4)-4:]
		}
		guestIDCardLast4 = &idLast4
	}

	permit := &model.VisitorPermit{
		PropertyID:       activeContract.PropertyID,
		TenantID:         tenantID,
		ContractID:       activeContract.ID,
		RoomID:           *activeContract.RoomID,
		GuestName:        req.GuestName,
		GuestPhone:       guestPhone,
		GuestIDCardLast4: guestIDCardLast4,
		Relationship:     strings.TrimSpace(req.Relationship),
		Purpose:          strings.TrimSpace(req.Purpose),
		IsOvernight:      req.IsOvernight,
		StartTime:        startTime,
		EndTime:          endTime,
		TotalGuests:      totalGuests,
		VehicleType:      vehicleType,
		VehicleNumber:    vehicleNumber,
	}

	created, err := h.repo.Create(c.Request.Context(), permit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan pengajuan izin tamu: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Permintaan izin tamu berhasil diajukan dan sedang menunggu persetujuan pengelola.",
		"data":    created,
	})
}

// TenantListPermits lists visitor permits submitted by the current tenant (AC 4, 5).
func (h *VisitorPermitHandler) TenantListPermits(c *gin.Context) {
	tenantID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	filter := model.VisitorPermitFilter{
		Status: c.Query("status"),
		Search: c.Query("search"),
	}

	if from := c.Query("from_date"); from != "" {
		if t, err := parseDateTime(from); err == nil {
			filter.StartDate = &t
		}
	}
	if to := c.Query("to_date"); to != "" {
		if t, err := parseDateTime(to); err == nil {
			filter.EndDate = &t
		}
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	filter.Limit = perPage
	filter.Offset = (page - 1) * perPage

	permits, total, err := h.repo.ListForTenant(c.Request.Context(), tenantID, filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar izin tamu: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     permits,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// TenantGetPermit retrieves a single visitor permit for the current tenant.
func (h *VisitorPermitHandler) TenantGetPermit(c *gin.Context) {
	tenantID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	permit, err := h.repo.GetByIDForTenant(c.Request.Context(), tenantID, permitID)
	if err != nil {
		if errors.Is(err, repository.ErrVisitorPermitNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Izin tamu tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	events, _ := h.repo.GetEvents(c.Request.Context(), permitID)

	c.JSON(http.StatusOK, gin.H{
		"data":   permit,
		"events": events,
	})
}

// TenantCancelPermit allows a tenant to cancel a pending permit request.
func (h *VisitorPermitHandler) TenantCancelPermit(c *gin.Context) {
	tenantID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	var req model.CancelVisitorPermitRequest
	_ = c.ShouldBindJSON(&req)
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		reason = "Dibatalkan oleh penyewa"
	}

	cancelled, err := h.repo.Cancel(c.Request.Context(), permitID, tenantID, reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Izin tamu berhasil dibatalkan",
		"data":    cancelled,
	})
}

// ListPermits retrieves visitor permits scoped to the active property with filtering (AC 4, 5).
func (h *VisitorPermitHandler) ListPermits(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}

	filter := model.VisitorPermitFilter{
		PropertyID: scope.PropertyID,
		Status:     c.Query("status"),
		Search:     c.Query("search"),
	}

	if from := c.Query("from_date"); from != "" {
		if t, err := parseDateTime(from); err == nil {
			filter.StartDate = &t
		}
	}
	if to := c.Query("to_date"); to != "" {
		if t, err := parseDateTime(to); err == nil {
			filter.EndDate = &t
		}
	}
	if overnight := c.Query("is_overnight"); overnight != "" {
		val := overnight == "true" || overnight == "1"
		filter.IsOvernight = &val
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	perPage, _ := strconv.Atoi(c.DefaultQuery("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}
	filter.Limit = perPage
	filter.Offset = (page - 1) * perPage

	permits, total, err := h.repo.List(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil daftar izin tamu: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":     permits,
		"total":    total,
		"page":     page,
		"per_page": perPage,
	})
}

// GetPermit retrieves details and audit event timeline for a permit (AC 3, 4).
func (h *VisitorPermitHandler) GetPermit(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	permit, err := h.repo.GetByID(c.Request.Context(), scope.PropertyID, permitID)
	if err != nil {
		if errors.Is(err, repository.ErrVisitorPermitNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Izin tamu tidak ditemukan"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	events, _ := h.repo.GetEvents(c.Request.Context(), permitID)

	c.JSON(http.StatusOK, gin.H{
		"data":   permit,
		"events": events,
	})
}

// ApprovePermit approves a visitor permit and generates visitor pass token (AC 3).
func (h *VisitorPermitHandler) ApprovePermit(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}
	actorID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	var req model.ReviewVisitorPermitRequest
	_ = c.ShouldBindJSON(&req)

	updated, err := h.repo.UpdateStatus(
		c.Request.Context(),
		scope.PropertyID,
		permitID,
		actorID,
		string(scope.Role),
		model.VisitorPermitStatusApproved,
		strings.TrimSpace(req.Reason),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Izin tamu disetujui",
		"data":    updated,
	})
}

// RejectPermit rejects a visitor permit with required reason (AC 3).
func (h *VisitorPermitHandler) RejectPermit(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}
	actorID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	var req model.ReviewVisitorPermitRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan penolakan izin tamu wajib diisi"})
		return
	}

	updated, err := h.repo.UpdateStatus(
		c.Request.Context(),
		scope.PropertyID,
		permitID,
		actorID,
		string(scope.Role),
		model.VisitorPermitStatusRejected,
		strings.TrimSpace(req.Reason),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Izin tamu ditolak",
		"data":    updated,
	})
}

// RequestChangePermit requests revisions to visitor details (AC 3).
func (h *VisitorPermitHandler) RequestChangePermit(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}
	actorID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	var req model.ReviewVisitorPermitRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Alasan permohonan perubahan wajib diisi"})
		return
	}

	updated, err := h.repo.UpdateStatus(
		c.Request.Context(),
		scope.PropertyID,
		permitID,
		actorID,
		string(scope.Role),
		model.VisitorPermitStatusChangeRequested,
		strings.TrimSpace(req.Reason),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Permintaan perubahan izin tamu telah dikirim ke penyewa",
		"data":    updated,
	})
}

// CheckInVisitor records visitor arrival at the property.
func (h *VisitorPermitHandler) CheckInVisitor(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}
	actorID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	updated, err := h.repo.CheckIn(c.Request.Context(), scope.PropertyID, permitID, actorID, string(scope.Role))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tamu berhasil di-check-in",
		"data":    updated,
	})
}

// CheckOutVisitor records visitor departure from the property.
func (h *VisitorPermitHandler) CheckOutVisitor(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}
	actorID, err := parseActorUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Autentikasi diperlukan"})
		return
	}

	permitID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID izin tamu tidak valid"})
		return
	}

	updated, err := h.repo.CheckOut(c.Request.Context(), scope.PropertyID, permitID, actorID, string(scope.Role))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Tamu berhasil di-check-out",
		"data":    updated,
	})
}

// GetSummary returns dashboard summary metrics for visitors today.
func (h *VisitorPermitHandler) GetSummary(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}

	summary, err := h.repo.GetSummary(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil ringkasan tamu: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// ApplyRetentionPolicy triggers retention anonymization of old visitor PII (AC 4).
func (h *VisitorPermitHandler) ApplyRetentionPolicy(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"error": "Akses properti diperlukan"})
		return
	}

	var req model.ApplyRetentionRequest
	_ = c.ShouldBindJSON(&req)
	olderThanDays := req.OlderThanDays
	if olderThanDays <= 0 {
		olderThanDays = 30
	}

	count, err := h.repo.ApplyRetention(c.Request.Context(), scope.PropertyID, olderThanDays)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menjalankan kebijakan retensi data tamu: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          fmt.Sprintf("Kebijakan retensi berhasil diterapkan. %d catatan data tamu telah dianonimkan.", count),
		"anonymized_count": count,
		"retention_days":   olderThanDays,
	})
}

// VerifyPass is a public verification endpoint for visitor pass QR code scanning (AC 4).
// Exposes minimal, sanitized verification data only.
func (h *VisitorPermitHandler) VerifyPass(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Token pass tidak valid"})
		return
	}

	pass, err := h.repo.GetByPassToken(c.Request.Context(), token)
	if err != nil {
		if errors.Is(err, repository.ErrVisitorPermitNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Pass tamu tidak ditemukan atau tidak valid"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": pass})
}
