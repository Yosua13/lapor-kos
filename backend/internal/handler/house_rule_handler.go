package handler

import (
	"errors"
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type HouseRuleHandler struct {
	repo     *repository.HouseRuleRepository
	userRepo repository.UserRepo
}

func NewHouseRuleHandler(repo *repository.HouseRuleRepository, userRepo repository.UserRepo) *HouseRuleHandler {
	return &HouseRuleHandler{
		repo:     repo,
		userRepo: userRepo,
	}
}

var defaultRuleTemplates = []model.RuleTemplateItem{
	{
		Category:    model.RuleCategoryKeamanan,
		Title:       "Akses & Jam Malam Gerbang Kos",
		Description: "Ketentuan mengenai jam operasional pintu gerbang utama demi keamanan seluruh penghuni kos.",
		Details: []string{
			"Pintu gerbang utama akan dikunci pada pukul 23:00 WIB demi keamanan bersama.",
			"Setiap penghuni dibekali kunci gerbang masing-masing dan bertanggung jawab penuh atas kunci tersebut.",
			"Jika pulang di atas pukul 23:00 WIB, harap mengunci kembali pintu gerbang dengan rapat setelah masuk.",
			"Dilarang menduplikat kunci gerbang atau meminjamkannya kepada pihak luar tanpa izin pemilik.",
		},
		Severity: model.RuleSeverityMajor,
	},
	{
		Category:    model.RuleCategoryKeamanan,
		Title:       "Kebijakan Penerimaan Tamu & Menginap",
		Description: "Prosedur dan batasan untuk kunjungan tamu demi kenyamanan dan privasi seluruh penghuni.",
		Details: []string{
			"Tamu diperbolehkan berkunjung maksimal hingga pukul 22:00 WIB di area ruang tamu bersama.",
			"Tamu lawan jenis dilarang keras masuk atau berada di dalam kamar hunian.",
			"Tamu yang berniat menginap wajib melaporkan diri melalui permohonan izin tamu paling lambat 1x24 jam sebelum kedatangan.",
			"Setiap tamu menginap yang disetujui dikenakan biaya tambahan sesuai tarif per malam yang berlaku.",
		},
		Severity: model.RuleSeverityMajor,
	},
	{
		Category:    model.RuleCategoryKebersihan,
		Title:       "Pengelolaan Sampah & Kebersihan Kamar",
		Description: "Kewajiban menjaga kebersihan kamar masing-masing dan tata cara pembuangan sampah.",
		Details: []string{
			"Setiap penghuni wajib menyediakan tempat sampah tertutup di dalam kamar masing-masing.",
			"Sampah harus dibuang ke tempat pembuangan sampah utama di luar kamar secara rutin setiap hari untuk menghindari bau dan serangga.",
			"Dilarang menimbun sampah di koridor depan kamar atau area jemuran.",
		},
		Severity: model.RuleSeverityStandard,
	},
	{
		Category:    model.RuleCategoryKebersihan,
		Title:       "Penggunaan & Perawatan Dapur Bersama",
		Description: "Aturan wajib dalam menggunakan fasilitas dapur bersama agar tetap bersih dan higienis.",
		Details: []string{
			"Setelah memasak, seluruh peralatan memasak (wajan, panci, piring, sendok) harus segera dicuci bersih dan dikembalikan ke tempatnya.",
			"Bersihkan sisa makanan atau minyak di kompor dan meja dapur setelah digunakan.",
			"Bahan makanan di kulkas bersama wajib diberi label nama pemilik dan dilarang mengambil milik orang lain tanpa izin.",
		},
		Severity: model.RuleSeverityStandard,
	},
	{
		Category:    model.RuleCategoryFasilitas,
		Title:       "Penggunaan Listrik & Peralatan Elektronik",
		Description: "Ketentuan penghematan energi dan pembatasan penggunaan alat elektronik berdaya tinggi.",
		Details: []string{
			"Matikan lampu, AC, kipas angin, dan kran air jika hendak bepergian keluar kamar.",
			"Penggunaan dispenser air panas, rice cooker, kulkas mini, microwave, atau televisi di dalam kamar wajib dilaporkan dan mendapat persetujuan pengelola.",
			"Dilarang melakukan modifikasi instalasi listrik di dalam kamar yang dapat memicu korsleting atau kebakaran.",
		},
		Severity: model.RuleSeverityCritical,
	},
	{
		Category:    model.RuleCategoryFasilitas,
		Title:       "Ketentuan Parkir Kendaraan",
		Description: "Tata cara memarkir kendaraan motor dan mobil di area parkir kos.",
		Details: []string{
			"Kendaraan harus diparkir dengan rapi sesuai dengan batas garis parkir yang telah disediakan.",
			"Setiap kendaraan wajib dipasang kunci ganda atau kunci pengaman tambahan.",
			"Pengelola tidak bertanggung jawab atas segala kerusakan atau kehilangan kendaraan dan barang di dalamnya.",
		},
		Severity: model.RuleSeverityStandard,
	},
	{
		Category:    model.RuleCategoryPembayaran,
		Title:       "Jatuh Tempo Pembayaran Sewa Kos",
		Description: "Prosedur pembayaran sewa bulanan dan ketentuan jatuh tempo pembayaran.",
		Details: []string{
			"Pembayaran sewa bulanan harus dilakukan tepat waktu sebelum atau pada tanggal jatuh tempo yang tertera di kontrak.",
			"Bukti transfer pembayaran wajib diunggah ke portal aplikasi Lapor Kos untuk diverifikasi pengelola.",
			"Keterlambatan tanpa pemberitahuan minimal 3 hari sebelum jatuh tempo dapat dikenakan sanksi.",
		},
		Severity: model.RuleSeverityMajor,
	},
	{
		Category:    model.RuleCategoryPembayaran,
		Title:       "Sanksi Keterlambatan & Denda Kerusakan",
		Description: "Ketentuan denda administratif karena keterlambatan bayar sewa atau kerusakan fasilitas.",
		Details: []string{
			"Keterlambatan pembayaran sewa dapat dikenakan denda administratif harian sesuai kebijakan penagihan.",
			"Keterlambatan lebih dari batas toleransi tanpa konfirmasi yang jelas dapat mengakibatkan peninjauan kontrak.",
			"Kerusakan fasilitas kamar atau area bersama yang disebabkan kelalaian penghuni menjadi tanggung jawab penghuni bersangkutan.",
		},
		Severity: model.RuleSeverityMajor,
	},
	{
		Category:    model.RuleCategoryKetertiban,
		Title:       "Ketertiban, Kebisingan & Etika Bersama",
		Description: "Etika bertingkah laku demi menjaga kedamaian dan kenyamanan bertetangga.",
		Details: []string{
			"Penghuni wajib menghormati sesama penghuni dan tetangga sekitar kos dengan menjaga ketertiban.",
			"Dilarang menyalakan musik atau bersuara keras yang dapat mengganggu ketenangan, khususnya pada jam tenang pukul 22:00 WIB s.d. 06:00 WIB.",
			"Dilarang membawa binatang peliharaan ke dalam area kamar maupun lingkungan kos tanpa persetujuan tertulis.",
		},
		Severity: model.RuleSeverityStandard,
	},
	{
		Category:    model.RuleCategoryUmum,
		Title:       "Larangan Barang Terlarang & Tindakan Ilegal",
		Description: "Aturan ketat mengenai barang-barang berbahaya dan tindakan melawan hukum.",
		Details: []string{
			"Dilarang keras membawa, menyimpan, mengonsumsi, atau mengedarkan narkoba dan minuman keras di lingkungan kos.",
			"Dilarang menyimpan senjata tajam, senjata api, bahan peledak, atau bahan kimia berbahaya lainnya.",
			"Segala bentuk tindakan perjudian, pornografi, asusila, atau tindakan kriminal lainnya akan langsung dilaporkan ke pihak berwajib dan pemutusan kontrak sepihak.",
		},
		Severity: model.RuleSeverityCritical,
	},
}

// GetTemplates returns predefined rule templates without any database modification (AC 1)
func (h *HouseRuleHandler) GetTemplates(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"templates": defaultRuleTemplates,
	})
}

// GetRules returns active rules for a property strictly as a read-only query (AC 1)
func (h *HouseRuleHandler) GetRules(c *gin.Context) {
	actorID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var propertyID uuid.UUID
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		propertyID = scope.PropertyID
	} else {
		var err error
		propertyID, _, err = h.repo.FindActiveContractContextByTenant(c.Request.Context(), actorID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusOK, []model.HouseRule{})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch active contract: " + err.Error()})
			return
		}
	}

	rules, err := h.repo.FindAllByProperty(c.Request.Context(), propertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rules: " + err.Error()})
		return
	}

	// Strictly read-only: return empty list if none exist, without writing to the database
	if rules == nil {
		rules = []model.HouseRule{}
	}
	c.JSON(http.StatusOK, rules)
}

// ListVersions lists all rule versions (draft, published, superseded) for a property
func (h *HouseRuleHandler) ListVersions(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	versions, err := h.repo.ListVersions(c.Request.Context(), scope.PropertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list rule versions: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"property_id": scope.PropertyID,
		"versions":    versions,
	})
}

// GetVersion returns details of a specific version including its rule items (AC 2)
func (h *HouseRuleHandler) GetVersion(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	versionID, err := uuid.Parse(c.Param("version_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}

	ver, err := h.repo.GetVersion(c.Request.Context(), scope.PropertyID, versionID)
	if err != nil {
		if errors.Is(err, repository.ErrRuleVersionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Rule version not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch version: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, ver)
}

// SaveDraft creates or updates the draft rule version with items
func (h *HouseRuleHandler) SaveDraft(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	var req model.SaveDraftRulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid draft payload: " + err.Error()})
		return
	}

	if len(req.Items) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Peraturan harus memiliki minimal 1 butir aturan"})
		return
	}

	draft, err := h.repo.SaveDraft(c.Request.Context(), scope.PropertyID, scope.ActorID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save draft rules: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Draft peraturan berhasil disimpan",
		"draft":   draft,
	})
}

// PublishVersion publishes a draft rule version, making it active and immutable (AC 2)
func (h *HouseRuleHandler) PublishVersion(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	versionID, err := uuid.Parse(c.Param("version_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}

	var req model.PublishRuleVersionRequest
	_ = c.ShouldBindJSON(&req)

	published, err := h.repo.PublishDraft(c.Request.Context(), scope.PropertyID, scope.ActorID, versionID, req.EffectiveFrom, req.ChangeSummary)
	if err != nil {
		if errors.Is(err, repository.ErrRuleVersionNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Rule version not found"})
			return
		}
		if errors.Is(err, repository.ErrEmptyRules) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "Tidak dapat menerbitkan versi aturan yang kosong"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Versi peraturan berhasil diterbitkan dan sekarang berstatus aktif serta immutable",
		"published": published,
	})
}

// GetActiveRules returns active published rules and acknowledgment status for the current user
func (h *HouseRuleHandler) GetActiveRules(c *gin.Context) {
	actorID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var propertyID uuid.UUID
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		propertyID = scope.PropertyID
	} else {
		var err error
		propertyID, _, err = h.repo.FindActiveContractContextByTenant(c.Request.Context(), actorID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				c.JSON(http.StatusOK, model.ActiveRulesResponse{Acknowledged: false})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch contract context: " + err.Error()})
			return
		}
	}

	ruleSet, err := h.repo.GetRuleSet(c.Request.Context(), propertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rule set: " + err.Error()})
		return
	}

	activeVer, err := h.repo.GetActivePublishedVersion(c.Request.Context(), propertyID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch active rules: " + err.Error()})
		return
	}

	resp := model.ActiveRulesResponse{
		RuleSet: ruleSet,
		Version: activeVer,
	}

	if activeVer != nil {
		ack, err := h.repo.GetTenantAcknowledgment(c.Request.Context(), propertyID, actorID, activeVer.ID, nil)
		if err == nil && ack != nil {
			resp.Acknowledged = true
			resp.Acknowledgment = ack
		} else {
			resp.Acknowledged = false
		}
	}

	c.JSON(http.StatusOK, resp)
}

// AcknowledgeRules records tenant acknowledgment for active published rules (AC 3, 5)
func (h *HouseRuleHandler) AcknowledgeRules(c *gin.Context) {
	actorID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req model.AcknowledgeRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Permintaan acknowledgment tidak valid: " + err.Error()})
		return
	}

	var propertyID uuid.UUID
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		propertyID = scope.PropertyID
	} else {
		var err error
		propertyID, _, err = h.repo.FindActiveContractContextByTenant(c.Request.Context(), actorID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Konteks properti aktif tidak ditemukan"})
			return
		}
	}

	ack, err := h.repo.AcknowledgeVersion(
		c.Request.Context(),
		propertyID,
		actorID,
		req.ContractID,
		req.RuleVersionID,
		c.ClientIP(),
		c.GetHeader("User-Agent"),
		req.ConsentText,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Gagal mencatat acknowledgment peraturan: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":        "Persetujuan peraturan kos berhasil dicatat secara resmi",
		"acknowledgment": ack,
	})
}

// ListAcknowledgments lists audit trail of acknowledgments for a rule version (AC 5)
func (h *HouseRuleHandler) ListAcknowledgments(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	versionID, err := uuid.Parse(c.Param("version_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid version ID"})
		return
	}

	acks, err := h.repo.ListAcknowledgments(c.Request.Context(), scope.PropertyID, versionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch acknowledgments: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"property_id":     scope.PropertyID,
		"version_id":      versionID,
		"acknowledgments": acks,
	})
}

// Legacy CRUD handlers for backward compatibility

func (h *HouseRuleHandler) CreateRule(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	var req model.HouseRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.PropertyID = scope.PropertyID
	req.OwnerID = scope.ActorID
	err := h.repo.Create(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create rule: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, req)
}

func (h *HouseRuleHandler) UpdateRule(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	var req model.HouseRule
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.ID = id
	req.PropertyID = scope.PropertyID
	req.OwnerID = scope.ActorID

	err = h.repo.Update(c.Request.Context(), &req)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rule: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, req)
}

func (h *HouseRuleHandler) DeleteRule(c *gin.Context) {
	scope, ok := middleware.GetPropertyScope(c)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Property context is required"})
		return
	}

	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rule ID"})
		return
	}

	err = h.repo.Delete(c.Request.Context(), id, scope.PropertyID)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Rule not found"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete rule: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rule deleted successfully"})
}
