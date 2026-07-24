package httpapi

import (
	"net/http"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/authz"
	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/Yosua13/lapor-kos/backend/internal/handler"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type handlers struct {
	auth            *handler.AuthHandler
	property        *handler.PropertyHandler
	room            *handler.RoomHandler
	contract        *handler.ContractHandler
	payment         *handler.PaymentHandler
	calendar        *handler.CalendarHandler
	complaint       *handler.ComplaintHandler
	houseRule       *handler.HouseRuleHandler
	report          *handler.ReportHandler
	file            *handler.FileHandler
	tenantLifecycle *handler.TenantLifecycleHandler
}

type repositories struct {
	db       *pgxpool.Pool
	user     *repository.UserRepository
	property *repository.PropertyRepository
}

func NewRouter(db *pgxpool.Pool, billingCron *cron.BillingCron, trustedProxies []string) (*gin.Engine, error) {
	emailService := service.NewEmailService()
	aiService := service.NewAIService()
	whatsAppService := service.NewWhatsAppService()
	storageService := service.NewStorageService()
	reportPDFService := service.NewReportPDFService()

	userRepo := repository.NewUserRepository(db)
	propertyRepo := repository.NewPropertyRepository(db)
	roomRepo := repository.NewRoomRepository(db)
	contractRepo := repository.NewContractRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	calendarRepo := repository.NewCalendarRepository(db)
	complaintRepo := repository.NewComplaintRepository(db)
	houseRuleRepo := repository.NewHouseRuleRepository(db)
	tenantLifecycleRepo := repository.NewTenantLifecycleRepository(db)

	h := handlers{
		auth:            handler.NewAuthHandler(userRepo, emailService, storageService),
		property:        handler.NewPropertyHandler(propertyRepo),
		room:            handler.NewRoomHandler(roomRepo, storageService),
		contract:        handler.NewContractHandler(contractRepo),
		payment:         handler.NewPaymentHandler(paymentRepo, storageService, userRepo),
		calendar:        handler.NewCalendarHandler(calendarRepo),
		complaint:       handler.NewComplaintHandler(complaintRepo, aiService, whatsAppService, storageService),
		houseRule:       handler.NewHouseRuleHandler(houseRuleRepo, userRepo),
		report:          handler.NewReportHandler(paymentRepo, userRepo, reportPDFService),
		file:            handler.NewFileHandler(storageService),
		tenantLifecycle: handler.NewTenantLifecycleHandler(tenantLifecycleRepo, userRepo, emailService, storageService),
	}
	repos := repositories{db: db, user: userRepo, property: propertyRepo}

	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	if len(trustedProxies) > 0 {
		if err := router.SetTrustedProxies(trustedProxies); err != nil {
			return nil, err
		}
	} else if err := router.SetTrustedProxies(nil); err != nil {
		return nil, err
	}
	router.Use(middleware.SecurityHeaders())
	router.Use(middleware.CORSMiddleware(middleware.CORSConfigFromEnv()))
	router.Use(middleware.RequestSizeLimit(12 << 20))

	api := router.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "UP", "database": "Connected",
			"message": "Lapor Kos API is running",
		})
	})
	api.POST("/cron/trigger", middleware.CronSecretMiddleware(), func(c *gin.Context) {
		billingCron.Trigger()
		c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Billing cron triggered"})
	})

	registerAuthRoutes(api, h.auth, repos.user)
	registerPropertyRoutes(api, h.property, repos)
	registerLegacyTenantRoutes(api, h, repos)
	registerTenantLifecycleRoutes(api, h.tenantLifecycle, repos)
	registerPropertyOperations(api, h, repos)
	registerPropertyOperations(api.Group("/v1/properties/:property_id"), h, repos)

	return router, nil
}

func registerTenantLifecycleRoutes(api *gin.RouterGroup, tenantHandler *handler.TenantLifecycleHandler, repos repositories) {
	// Invitation lookup and activation are intentionally public: the random,
	// single-use token is the capability. No property or user data is exposed.
	api.GET("/tenant-invitations/:token", middleware.RateLimit(20, time.Minute), tenantHandler.PreviewInvitation)
	api.POST("/tenant-invitations/activate", middleware.RateLimit(10, time.Minute), tenantHandler.ActivateInvitation)

	authn := middleware.AuthMiddleware(repos.user)
	propertyRepo := repos.property
	invitations := api.Group("/tenant-invitations", authn)
	invitations.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), tenantHandler.ListInvitations)
	invitations.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), tenantHandler.CreateInvitation)
	invitations.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), tenantHandler.RevokeInvitation)

	profiles := api.Group("/tenant-profiles", authn)
	profiles.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), tenantHandler.ListProfiles)
	profiles.GET("/:profile_id/documents", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), tenantHandler.ListDocuments)
	profiles.POST("/:profile_id/documents", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), tenantHandler.UploadDocument)
	profiles.GET("/:profile_id/documents/:document_id/sign", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), tenantHandler.SignDocument)

	tenantRole := middleware.RoleMiddleware(repos.db, "tenant")
	api.GET("/tenants/me/documents/:document_id/sign", authn, tenantRole, tenantHandler.SignMyDocument)
}

func registerAuthRoutes(api *gin.RouterGroup, authHandler *handler.AuthHandler, userRepo *repository.UserRepository) {
	auth := api.Group("/auth")
	auth.POST("/register", middleware.RateLimit(5, 10*time.Second), authHandler.Register)
	auth.POST("/login", middleware.RateLimit(10, 10*time.Second), authHandler.Login)
	auth.GET("/verify-email", authHandler.VerifyEmail)
	auth.POST("/forgot-password", middleware.RateLimit(5, 10*time.Second), authHandler.ForgotPassword)
	auth.POST("/verify-otp", middleware.RateLimit(10, 10*time.Second), authHandler.VerifyOTP)
	auth.POST("/reset-password", middleware.RateLimit(5, 10*time.Second), authHandler.ResetPassword)
	auth.GET("/me", middleware.AuthMiddleware(userRepo), authHandler.Me)
	auth.PUT("/profile", middleware.AuthMiddleware(userRepo), authHandler.UpdateProfile)
	auth.PUT("/password", middleware.AuthMiddleware(userRepo), authHandler.UpdatePassword)
}

func registerPropertyRoutes(api *gin.RouterGroup, propertyHandler *handler.PropertyHandler, repos repositories) {
	authn := middleware.AuthMiddleware(repos.user)
	properties := api.Group("/properties", authn)
	properties.GET("", propertyHandler.ListProperties)
	properties.POST("", propertyHandler.CreateProperty)
	properties.PATCH("/:property_id",
		middleware.RequirePropertyAccess(repos.property, authz.PermissionPropertyUpdate),
		propertyHandler.UpdateProperty,
	)
	properties.GET("/:property_id/members",
		middleware.RequirePropertyAccess(repos.property, authz.PermissionMembershipRead),
		propertyHandler.ListMembers,
	)
	properties.POST("/:property_id/members",
		middleware.RequirePropertyAccess(repos.property, authz.PermissionMembershipManage),
		propertyHandler.AddMember,
	)
	properties.PATCH("/:property_id/members/:membership_id",
		middleware.RequirePropertyAccess(repos.property, authz.PermissionMembershipManage),
		propertyHandler.UpdateMember,
	)
	properties.DELETE("/:property_id/members/:membership_id",
		middleware.RequirePropertyAccess(repos.property, authz.PermissionMembershipManage),
		propertyHandler.DeleteMember,
	)
}

// Tenant self-service remains account-role based for compatibility. Its data
// boundary is derived server-side from the tenant's active contract.
func registerLegacyTenantRoutes(api *gin.RouterGroup, h handlers, repos repositories) {
	authn := middleware.AuthMiddleware(repos.user)
	tenantRole := middleware.RoleMiddleware(repos.db, "tenant")

	tenants := api.Group("/tenants", authn)
	tenants.GET("/me", tenantRole, h.auth.GetMyTenantProfile)

	payments := api.Group("/payments", authn)
	payments.GET("/my", tenantRole, h.payment.GetTenantPayments)
	payments.POST("/:id/submit", tenantRole, h.payment.SubmitPaymentProof)

	complaints := api.Group("/complaints", authn)
	complaints.POST("", tenantRole, h.complaint.CreateComplaint)
	complaints.POST("/upload", tenantRole, h.complaint.UploadPhoto)
	complaints.GET("/my", tenantRole, h.complaint.GetTenantComplaints)
}

func registerPropertyOperations(api *gin.RouterGroup, h handlers, repos repositories) {
	// The canonical v1 group already contains :property_id. Legacy routes use
	// the same middleware with X-Property-ID, keeping one authorization path.
	authn := middleware.AuthMiddleware(repos.user)
	propertyRepo := repos.property

	rooms := api.Group("/rooms", authn)
	rooms.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomRead), h.room.GetRooms)
	rooms.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomRead), h.room.GetRoom)
	rooms.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.room.CreateRoom)
	rooms.POST("/with-tenant", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.room.CreateRoomWithTenant)
	rooms.POST("/:id/assign-tenant", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.room.AssignTenant)
	rooms.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.room.UpdateRoom)
	rooms.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomDelete), h.room.DeleteRoom)

	tenants := api.Group("/tenants", authn)
	tenants.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), h.auth.GetTenantProfileByID)
	tenants.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.UpdateTenantProfileByID)
	tenants.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantDelete), h.auth.DeleteTenantByID)
	tenants.POST("/:id/checkout", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.CheckoutTenant)
	tenants.POST("/:id/change-room", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.ChangeRoom)
	tenants.POST("/:id/extend-contract", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.auth.ExtendContract)

	contracts := api.Group("/contracts", authn)
	contracts.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractRead), h.contract.GetContracts)
	contracts.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractRead), h.contract.GetContract)
	contracts.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.CreateContract)
	contracts.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.UpdateContract)
	contracts.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractDelete), h.contract.DeleteContract)

	payments := api.Group("/payments", authn)
	payments.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetAllPayments)
	payments.GET("/:id", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetPayment)
	payments.GET("/:id/receipt", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetReceiptHTML)
	payments.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentWrite), h.payment.CreatePaymentBill)
	payments.PUT("/:id/verify", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentVerify), h.payment.VerifyPayment)

	reports := api.Group("/reports", authn)
	reports.GET("/financial.pdf", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionReportRead), h.report.GetFinancialReportPDF)

	calendar := api.Group("/calendar", authn)
	calendar.GET("/events", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCalendarRead), h.calendar.GetEvents)

	complaints := api.Group("/complaints", authn)
	complaints.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetOwnerComplaints)
	complaints.PUT("/:id/status", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.UpdateComplaintStatus)
	complaints.PUT("/whatsapp-group", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPropertyUpdate), h.complaint.UpdateWhatsAppGroup)

	rules := api.Group("/rules", authn)
	rules.GET("", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionHouseRuleRead), h.houseRule.GetRules)
	rules.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.CreateRule)
	rules.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.UpdateRule)
	rules.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.DeleteRule)

	files := api.Group("/files", authn)
	files.GET("/sign", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionFileRead), h.file.SignPropertyFile)
}
