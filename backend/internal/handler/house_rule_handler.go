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

var defaultRulesSeed = []struct {
	Category    string
	Title       string
	Description string
	Details     []string
}{
	{
		Category:    "keamanan",
		Title:       "Akses & Jam Malam Gerbang Kos",
		Description: "Ketentuan mengenai jam operasional pintu gerbang utama demi keamanan seluruh penghuni kos.",
		Details: []string{
			"Pintu gerbang utama akan dikunci pada pukul 23:00 WIB demi keamanan bersama.",
			"Setiap penghuni dibekali kunci gerbang masing-masing dan bertanggung jawab penuh atas kunci tersebut.",
			"Jika pulang di atas pukul 23:00 WIB, harap mengunci kembali pintu gerbang dengan rapat setelah masuk.",
			"Dilarang menduplikat kunci gerbang atau meminjamkannya kepada pihak luar tanpa izin pemilik.",
		},
	},
	{
		Category:    "keamanan",
		Title:       "Kebijakan Penerimaan Tamu & Menginap",
		Description: "Prosedur dan batasan untuk kunjungan tamu demi kenyamanan dan privasi seluruh penghuni.",
		Details: []string{
			"Tamu diperbolehkan berkunjung maksimal hingga pukul 22:00 WIB di area ruang tamu bersama.",
			"Tamu lawan jenis dilarang keras masuk atau berada di dalam kamar hunian.",
			"Tamu yang berniat menginap wajib melaporkan diri kepada pemilik kos paling lambat 1x24 jam sebelum menginap.",
			"Setiap tamu yang menginap dikenakan biaya tambahan sebesar Rp 50.000 per malam (maksimal menginap 3 hari berturut-turut).",
		},
	},
	{
		Category:    "kebersihan",
		Title:       "Pengelolaan Sampah & Kebersihan Kamar",
		Description: "Kewajiban menjaga kebersihan kamar masing-masing dan tata cara pembuangan sampah.",
		Details: []string{
			"Setiap penghuni wajib menyediakan tempat sampah tertutup di dalam kamar masing-masing.",
			"Sampah harus dibuang ke tempat pembuangan sampah utama (tempat sampah besar di luar) secara rutin setiap hari untuk menghindari bau dan serangga.",
			"Dilarang menimbun sampah di koridor depan kamar atau area jemuran.",
		},
	},
	{
		Category:    "kebersihan",
		Title:       "Penggunaan & Perawatan Dapur Bersama",
		Description: "Aturan wajib dalam menggunakan fasilitas dapur bersama agar tetap bersih dan higienis.",
		Details: []string{
			"Setelah memasak, seluruh peralatan memasak (wajan, panci, piring, sendok) harus segera dicuci bersih dan dikembalikan ke tempatnya.",
			"Bersihkan sisa makanan atau minyak di kompor dan meja dapur setelah digunakan.",
			"Bahan makanan di kulkas bersama wajib diberi label nama pemilik dan tidak boleh mengambil barang milik orang lain tanpa izin.",
		},
	},
	{
		Category:    "fasilitas",
		Title:       "Penggunaan Listrik & Peralatan Elektronik",
		Description: "Ketentuan penghematan energi dan pembatasan penggunaan alat elektronik berdaya tinggi.",
		Details: []string{
			"Matikan lampu, AC, kipas angin, dan kran air jika hendak bepergian keluar kamar.",
			"Penggunaan dispenser air panas, rice cooker, kulkas mini, microwave, atau televisi di dalam kamar wajib dilaporkan dan mendapat persetujuan pemilik.",
			"Dilarang melakukan modifikasi instalasi listrik di dalam kamar yang dapat memicu korsleting.",
		},
	},
	{
		Category:    "fasilitas",
		Title:       "Ketentuan Parkir Kendaraan",
		Description: "Tata cara memarkir kendaraan motor dan mobil di area parkir kos.",
		Details: []string{
			"Kendaraan harus diparkir dengan rapi sesuai dengan batas garis parkir yang telah disediakan.",
			"Setiap kendaraan wajib dipasang kunci ganda atau kunci pengaman tambahan.",
			"Pemilik kos tidak bertanggung jawab atas segala kerusakan atau kehilangan kendaraan dan barang di dalamnya.",
		},
	},
	{
		Category:    "pembayaran",
		Title:       "Jatuh Tempo Pembayaran Sewa Kos",
		Description: "Prosedur pembayaran sewa bulanan dan ketentuan jatuh tempo pembayaran.",
		Details: []string{
			"Pembayaran sewa bulanan harus dilakukan tepat waktu sebelum atau pada tanggal jatuh tempo yang tertera di kontrak.",
			"Bukti transfer pembayaran wajib diunggah ke portal aplikasi Lapor Kos untuk diverifikasi pemilik.",
			"Keterlambatan tanpa pemberitahuan minimal 3 hari sebelum jatuh tempo akan dikenakan sanksi.",
		},
	},
	{
		Category:    "pembayaran",
		Title:       "Sanksi Keterlambatan & Denda Kerusakan",
		Description: "Ketentuan denda administratif karena keterlambatan bayar sewa atau kerusakan fasilitas.",
		Details: []string{
			"Keterlambatan pembayaran sewa dikenakan denda administratif sebesar Rp 20.000 per hari.",
			"Keterlambatan lebih dari 7 hari tanpa konfirmasi yang jelas dapat mengakibatkan pemutusan kontrak sepihak.",
			"Kerusakan fasilitas kamar atau area bersama yang disebabkan kelalaian penghuni menjadi tanggung jawab penghuni bersangkutan untuk biaya perbaikannya.",
		},
	},
	{
		Category:    "umum",
		Title:       "Ketertiban, Kebisingan & Etika Bersama",
		Description: "Etika bertingkah laku demi menjaga kedamaian dan kenyamanan bertetangga.",
		Details: []string{
			"Penghuni wajib menghormati penghuni lain dan tetangga sekitar kos dengan menjaga ketertiban.",
			"Dilarang menyalakan musik atau bersuara keras yang dapat mengganggu ketenangan penghuni lain, khususnya pada pukul 22:00 WIB s.d. 06:00 WIB.",
			"Dilarang membawa binatang peliharaan ke dalam area kamar maupun lingkungan kos.",
		},
	},
	{
		Category:    "umum",
		Title:       "Larangan Barang Terlarang & Tindakan Ilegal",
		Description: "Aturan ketat mengenai barang-barang berbahaya dan tindakan melawan hukum.",
		Details: []string{
			"Dilarang keras membawa, menyimpan, mengonsumsi, atau mengedarkan narkoba dan minuman keras di lingkungan kos.",
			"Dilarang menyimpan senjata tajam, senjata api, bahan peledak, atau bahan kimia berbahaya lainnya.",
			"Segala bentuk tindakan perjudian, pornografi, asusila, atau tindakan kriminal lainnya akan langsung dilaporkan ke pihak berwajib dan dikeluarkan secara tidak hormat.",
		},
	},
}

func (h *HouseRuleHandler) GetRules(c *gin.Context) {
	actorID, ok := currentUserID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var propertyID, seedOwnerID uuid.UUID
	var canSeed bool
	if scope, hasScope := middleware.GetPropertyScope(c); hasScope {
		propertyID = scope.PropertyID
		seedOwnerID = scope.ActorID
		canSeed = scope.Role == model.PropertyRoleOwner || scope.Role == model.PropertyRoleManager
	} else {
		var err error
		propertyID, seedOwnerID, err = h.repo.FindActiveContractContextByTenant(c.Request.Context(), actorID)
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

	// Seeding if database is empty for this owner
	if len(rules) == 0 && canSeed {
		var seedRules []model.HouseRule
		for _, seed := range defaultRulesSeed {
			seedRules = append(seedRules, model.HouseRule{
				PropertyID:  propertyID,
				OwnerID:     seedOwnerID,
				Category:    seed.Category,
				Title:       seed.Title,
				Description: seed.Description,
				Details:     seed.Details,
			})
		}
		err = h.repo.BulkCreate(c.Request.Context(), seedRules)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to seed default rules: " + err.Error()})
			return
		}

		rules, err = h.repo.FindAllByProperty(c.Request.Context(), propertyID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch seeded rules: " + err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, rules)
}

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
