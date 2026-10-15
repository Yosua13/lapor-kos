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
	invoice         *handler.InvoiceHandler
	roomTransfer    *handler.RoomTransferHandler
	checkout        *handler.CheckoutHandler
	notification    *handler.NotificationHandler
	visitorPermit   *handler.VisitorPermitHandler
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
	contractDocumentService := service.NewContractDocumentService()

	userRepo := repository.NewUserRepository(db)
	propertyRepo := repository.NewPropertyRepository(db)
	roomRepo := repository.NewRoomRepository(db)
	contractRepo := repository.NewContractRepository(db)
	contractLifecycleRepo := repository.NewContractLifecycleRepository(db, contractRepo)
	paymentRepo := repository.NewPaymentRepository(db)
	calendarRepo := repository.NewCalendarRepository(db)
	complaintRepo := repository.NewComplaintRepository(db)
	houseRuleRepo := repository.NewHouseRuleRepository(db)
	tenantLifecycleRepo := repository.NewTenantLifecycleRepository(db)
	invoiceRepo := repository.NewInvoiceRepository(db)
	roomTransferRepo := repository.NewRoomTransferRepository(db)
	checkoutRepo := repository.NewCheckoutRepository(db)
	notificationRepo := repository.NewNotificationRepository(db)
	visitorPermitRepo := repository.NewVisitorPermitRepository(db)

	deliveryCron := cron.NewDeliveryCron(notificationRepo, whatsAppService, emailService)
	deliveryCron.Start()

	h := handlers{
		auth:            handler.NewAuthHandler(userRepo, emailService, storageService),
		property:        handler.NewPropertyHandler(propertyRepo),
		room:            handler.NewRoomHandler(roomRepo, storageService),
		contract:        handler.NewContractHandler(contractRepo, contractLifecycleRepo, contractDocumentService),
		payment:         handler.NewPaymentHandler(paymentRepo, storageService, userRepo),
		calendar:        handler.NewCalendarHandler(calendarRepo),
		complaint:       handler.NewComplaintHandler(complaintRepo, aiService, whatsAppService, storageService, notificationRepo),
		houseRule:       handler.NewHouseRuleHandler(houseRuleRepo, userRepo),
		report:          handler.NewReportHandler(paymentRepo, userRepo, reportPDFService),
		file:            handler.NewFileHandler(storageService),
		tenantLifecycle: handler.NewTenantLifecycleHandler(tenantLifecycleRepo, userRepo, emailService, whatsAppService, storageService),
		invoice:         handler.NewInvoiceHandler(invoiceRepo, billingCron),
		roomTransfer:    handler.NewRoomTransferHandler(roomTransferRepo, db),
		checkout:        handler.NewCheckoutHandler(checkoutRepo, db),
		notification:    handler.NewNotificationHandler(notificationRepo, whatsAppService, emailService),
		visitorPermit:   handler.NewVisitorPermitHandler(visitorPermitRepo),
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
		results, err := billingCron.Trigger(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Billing job failed"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "success", "runs": results})
	})
	api.POST("/payments/webhook", h.payment.ProcessWebhook)
	api.POST("/payments/webhook/:provider", h.payment.ProcessWebhook)
	api.GET("/visitor-passes/:token", middleware.RateLimit(30, time.Minute), h.visitorPermit.VerifyPass)

	registerAuthRoutes(api, h.auth, repos.user)
	registerPropertyRoutes(api, h.property, repos)
	registerLegacyTenantRoutes(api, h, repos)
	registerTenantLifecycleRoutes(api, h.tenantLifecycle, repos)
	registerNotificationRoutes(api, h.notification, repos)
	registerPropertyOperations(api, h, repos)
	registerPropertyOperations(api.Group("/v1/properties/:property_id"), h, repos)

	return router, nil
}

func registerTenantLifecycleRoutes(api *gin.RouterGroup, tenantHandler *handler.TenantLifecycleHandler, repos repositories) {
	// Invitation lookup and activation are intentionally public: the random,
	// single-use token is the capability. No property or user data is exposed.
	api.GET("/tenant-invitations/activation-status", middleware.RateLimit(30, time.Minute), tenantHandler.ActivationStatus)
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
	api.GET("/contracts/:id/review", authn, tenantRole, h.contract.ReviewContract)
	api.POST("/contracts/:id/accept", authn, tenantRole, h.contract.AcceptContract)
	api.GET("/contracts/:id/review/documents/:document_id", authn, tenantRole, h.contract.DownloadTenantContractDocument)

	payments := api.Group("/payments", authn)
	payments.GET("/my", tenantRole, h.payment.GetTenantPayments)
	payments.POST("/:id/submit", tenantRole, h.payment.SubmitPaymentProof)
	invoices := api.Group("/invoices", authn)
	invoices.GET("/my", tenantRole, h.invoice.ListMine)
	invoices.GET("/:id/my", tenantRole, h.invoice.GetMine)

	roomTransfers := api.Group("/room-transfers", authn)
	roomTransfers.GET("/my", tenantRole, h.roomTransfer.ListMyTransfers)
	roomTransfers.POST("/my/preview", tenantRole, h.roomTransfer.PreviewMyTransfer)
	roomTransfers.POST("/my", tenantRole, h.roomTransfer.CreateMyTransfer)
	roomTransfers.POST("/my/:id/cancel", tenantRole, h.roomTransfer.CancelMyTransfer)
	tenants.GET("/me/room-history", tenantRole, h.roomTransfer.GetMyRoomHistory)

	checkouts := api.Group("/checkouts", authn)
	checkouts.GET("/my", tenantRole, h.checkout.TenantListCheckouts)
	checkouts.POST("/my", tenantRole, h.checkout.TenantCreateNotice)
	checkouts.GET("/my/:id", tenantRole, h.checkout.TenantGetCheckout)

	visitorPermits := api.Group("/visitor-permits", authn)
	visitorPermits.GET("/my", tenantRole, h.visitorPermit.TenantListPermits)
	visitorPermits.POST("/my", tenantRole, h.visitorPermit.TenantCreatePermit)
	visitorPermits.GET("/my/:id", tenantRole, h.visitorPermit.TenantGetPermit)
	visitorPermits.POST("/my/:id/cancel", tenantRole, h.visitorPermit.TenantCancelPermit)

	complaints := api.Group("/complaints", authn)
	complaints.POST("", tenantRole, h.complaint.CreateComplaint)
	complaints.POST("/upload", tenantRole, h.complaint.UploadPhoto)
	complaints.GET("/my", tenantRole, h.complaint.GetTenantComplaints)
	complaints.GET("/my/:id", tenantRole, h.complaint.GetTenantComplaintByID)
	complaints.GET("/my/:id/timeline", tenantRole, h.complaint.GetComplaintTimeline)
	complaints.POST("/my/:id/events", tenantRole, h.complaint.AddComplaintEvent)
	complaints.POST("/my/:id/confirm", tenantRole, h.complaint.TenantConfirmResolution)
	complaints.POST("/my/:id/reopen", tenantRole, h.complaint.TenantReopenComplaint)
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
	tenants.GET("/:id/room-history", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantRead), h.roomTransfer.GetTenantRoomHistory)
	tenants.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.UpdateTenantProfileByID)
	tenants.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantDelete), h.auth.DeleteTenantByID)
	tenants.POST("/:id/checkout", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.CheckoutTenant)
	tenants.POST("/:id/change-room", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionTenantWrite), h.auth.ChangeRoom)
	tenants.POST("/:id/extend-contract", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.auth.ExtendContract)

	transfers := api.Group("/room-transfers", authn)
	transfers.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomRead), h.roomTransfer.ListTransfers)
	transfers.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomRead), h.roomTransfer.GetTransfer)
	transfers.POST("/preview", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.PreviewTransfer)
	transfers.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.CreateTransfer)
	transfers.PUT("/:id/approve", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.ApproveTransfer)
	transfers.PUT("/:id/reject", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.RejectTransfer)
	transfers.POST("/:id/execute", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.ExecuteTransfer)
	transfers.POST("/:id/cancel", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionRoomWrite), h.roomTransfer.CancelTransfer)

	contracts := api.Group("/contracts", authn)
	contracts.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractRead), h.contract.GetContracts)
	contracts.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractRead), h.contract.GetContract)
	contracts.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.CreateContract)
	contracts.POST("/:id/transitions", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.TransitionContract)
	contracts.POST("/:id/amendments", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.AmendContract)
	contracts.POST("/:id/renewals", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.RenewContract)
	contracts.POST("/:id/documents", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.PublishContractDocument)
	contracts.GET("/:id/documents/:document_id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractRead), h.contract.DownloadContractDocument)
	contracts.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractWrite), h.contract.UpdateContract)
	contracts.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionContractDelete), h.contract.DeleteContract)

	payments := api.Group("/payments", authn)
	payments.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetAllPayments)
	payments.GET("/:id", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetPayment)
	payments.GET("/:id/receipt", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetReceiptHTML)
	payments.GET("/:id/receipt-data", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetReceipt)
	payments.GET("/reconciliation", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentRead), h.payment.GetReconciliationReport)
	payments.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentWrite), h.payment.CreatePaymentBill)
	payments.PUT("/:id/verify", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentVerify), h.payment.VerifyPayment)
	payments.POST("/refunds", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentWrite), h.payment.CreateRefund)
	payments.PUT("/refunds/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPaymentVerify), h.payment.ProcessRefund)

	invoices := api.Group("/invoices", authn)
	invoices.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceRead), h.invoice.List)
	invoices.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceRead), h.invoice.Get)
	invoices.POST("/:id/adjustments/preview", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceWrite), h.invoice.PreviewAdjustment)
	invoices.POST("/:id/adjustments", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceWrite), h.invoice.CreateAdjustment)
	invoices.POST("/generate", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceGenerate), h.invoice.Generate)
	invoices.POST("/final-settlements/:contract_id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceWrite), h.invoice.CreateFinalSettlement)

	billing := api.Group("/billing", authn)
	billing.GET("/policy", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceRead), h.invoice.GetPolicy)
	billing.PUT("/policy", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceWrite), h.invoice.UpdatePolicy)
	billing.GET("/jobs", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceRead), h.invoice.ListJobs)
	billing.POST("/meter-readings", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionInvoiceWrite), h.invoice.RecordMeter)

	reports := api.Group("/reports", authn)
	reports.GET("/financial.pdf", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionReportRead), h.report.GetFinancialReportPDF)

	calendar := api.Group("/calendar", authn)
	calendar.GET("/events", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCalendarRead), h.calendar.GetEvents)

	complaints := api.Group("/complaints", authn)
	complaints.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetOwnerComplaints)
	complaints.GET("/sla-dashboard", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetSLADashboard)
	complaints.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetComplaintByID)
	complaints.PUT("/:id/status", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.UpdateComplaintStatus)
	complaints.POST("/:id/triage", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.TriageComplaint)
	complaints.POST("/:id/assign", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.AssignComplaint)
	complaints.GET("/:id/timeline", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetComplaintTimeline)
	complaints.POST("/:id/events", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.AddComplaintEvent)
	complaints.GET("/:id/ai-suggestion", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintRead), h.complaint.GetAISuggestion)
	complaints.POST("/:id/ai-suggestion/apply", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionComplaintWrite), h.complaint.ApplyAISuggestion)
	complaints.GET("/:id/work-orders", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionWorkOrderRead), h.complaint.ListWorkOrders)
	complaints.POST("/:id/work-orders", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionWorkOrderWrite), h.complaint.CreateWorkOrder)
	complaints.PUT("/:id/work-orders/:wo_id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionWorkOrderWrite), h.complaint.UpdateWorkOrder)
	complaints.PUT("/whatsapp-group", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionPropertyUpdate), h.complaint.UpdateWhatsAppGroup)

	vendors := api.Group("/vendors", authn)
	vendors.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVendorRead), h.complaint.ListVendors)
	vendors.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVendorWrite), h.complaint.CreateVendor)
	vendors.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVendorWrite), h.complaint.UpdateVendor)

	rules := api.Group("/rules", authn)
	rules.GET("", middleware.OptionalPropertyAccess(propertyRepo, authz.PermissionHouseRuleRead), h.houseRule.GetRules)
	rules.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.CreateRule)
	rules.PUT("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.UpdateRule)
	rules.DELETE("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionHouseRuleWrite), h.houseRule.DeleteRule)

	files := api.Group("/files", authn)
	files.GET("/sign", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionFileRead), h.file.SignPropertyFile)

	checkouts := api.Group("/checkouts", authn)
	checkouts.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutRead), h.checkout.ListCheckouts)
	checkouts.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutRead), h.checkout.GetCheckout)
	checkouts.POST("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutWrite), h.checkout.CreateCheckout)
	checkouts.POST("/:id/inspections", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutWrite), h.checkout.RecordInspections)
	checkouts.GET("/:id/settlement-preview", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutRead), h.checkout.PreviewSettlement)
	checkouts.POST("/:id/approve", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutApprove), h.checkout.ApproveSettlement)
	checkouts.POST("/:id/execute", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutApprove), h.checkout.ExecuteCheckout)
	checkouts.POST("/:id/cancel", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutWrite), h.checkout.CancelCheckout)
	checkouts.POST("/:id/room-override", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionCheckoutApprove), h.checkout.OverrideRoom)

	notifications := api.Group("/notifications", authn)
	notifications.GET("/outbox", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionNotificationRead), h.notification.ListOutbox)
	notifications.GET("/outbox/:outboxId", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionNotificationRead), h.notification.GetOutboxItem)
	notifications.POST("/outbox/:outboxId/retry", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionNotificationRetry), h.notification.RetryOutboxItem)

	visitorPermits := api.Group("/visitor-permits", authn)
	visitorPermits.GET("", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitRead), h.visitorPermit.ListPermits)
	visitorPermits.GET("/summary", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitRead), h.visitorPermit.GetSummary)
	visitorPermits.GET("/:id", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitRead), h.visitorPermit.GetPermit)
	visitorPermits.POST("/:id/approve", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitApprove), h.visitorPermit.ApprovePermit)
	visitorPermits.POST("/:id/reject", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitApprove), h.visitorPermit.RejectPermit)
	visitorPermits.POST("/:id/request-change", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitApprove), h.visitorPermit.RequestChangePermit)
	visitorPermits.POST("/:id/check-in", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitCheckInOut), h.visitorPermit.CheckInVisitor)
	visitorPermits.POST("/:id/check-out", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitCheckInOut), h.visitorPermit.CheckOutVisitor)
	visitorPermits.POST("/retention/apply", middleware.RequirePropertyAccess(propertyRepo, authz.PermissionVisitorPermitApprove), h.visitorPermit.ApplyRetentionPolicy)
}

func registerNotificationRoutes(api *gin.RouterGroup, notifHandler *handler.NotificationHandler, repos repositories) {
	authn := middleware.AuthMiddleware(repos.user)
	notifs := api.Group("/notifications", authn)
	notifs.GET("", notifHandler.ListNotifications)
	notifs.GET("/unread-count", notifHandler.GetUnreadCount)
	notifs.POST("/:id/read", notifHandler.MarkRead)
	notifs.POST("/read-all", notifHandler.MarkAllRead)
	notifs.DELETE("/:id", notifHandler.DeleteNotification)
	notifs.GET("/preferences", notifHandler.GetPreferences)
	notifs.PUT("/preferences", notifHandler.UpdatePreferences)
}
