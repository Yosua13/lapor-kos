package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/Yosua13/lapor-kos/backend/internal/handler"
	"github.com/Yosua13/lapor-kos/backend/internal/middleware"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Connect to database using pgxpool
	dbPool, err := pgxpool.New(context.Background(), dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}
	defer dbPool.Close()

	// Verify connection
	if err := dbPool.Ping(context.Background()); err != nil {
		log.Fatalf("Database ping failed: %v\n", err)
	}
	log.Println("Successfully connected to PostgreSQL via pgxpool")

	// Run schema migrations/updates
	_, err = dbPool.Exec(context.Background(), `ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50) NOT NULL DEFAULT '';`)
	if err != nil {
		log.Printf("Warning: Failed to run inline migration to add phone to users: %v", err)
	} else {
		log.Println("Inline migration: users.phone column verified/created")
	}

	// Initialize services
	emailServ := service.NewEmailService()
	aiServ := service.NewAIService()
	waServ := service.NewWhatsAppService()
	storageServ := service.NewStorageService()

	// Initialize repositories
	userRepo := repository.NewUserRepository(dbPool)
	roomRepo := repository.NewRoomRepository(dbPool)
	tenantRepo := repository.NewTenantRepository(dbPool)
	contractRepo := repository.NewContractRepository(dbPool)
	paymentRepo := repository.NewPaymentRepository(dbPool)
	calendarRepo := repository.NewCalendarRepository(dbPool)
	complaintRepo := repository.NewComplaintRepository(dbPool)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(userRepo, emailServ)
	roomHandler := handler.NewRoomHandler(roomRepo, storageServ)
	tenantHandler := handler.NewTenantHandler(tenantRepo, storageServ)
	contractHandler := handler.NewContractHandler(contractRepo)
	paymentHandler := handler.NewPaymentHandler(paymentRepo, tenantRepo, storageServ)
	calendarHandler := handler.NewCalendarHandler(calendarRepo)
	complaintHandler := handler.NewComplaintHandler(complaintRepo, userRepo, aiServ, waServ, storageServ)

	router := gin.Default()

	// Note: /uploads route removed - files are now served from Supabase Storage CDN.

	// CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Routes
	api := router.Group("/api")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":   "UP",
				"database": "Connected",
				"message":  "Lapor Kos API is running",
			})
		})

		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.GET("/verify-email", authHandler.VerifyEmail)
			auth.POST("/forgot-password", authHandler.ForgotPassword)
			auth.POST("/verify-otp", authHandler.VerifyOTP)
			auth.POST("/reset-password", authHandler.ResetPassword)
			auth.GET("/me", middleware.AuthMiddleware(), authHandler.Me)
			auth.PUT("/profile", middleware.AuthMiddleware(), authHandler.UpdateProfile)
			auth.PUT("/password", middleware.AuthMiddleware(), authHandler.UpdatePassword)
		}

		// Room routes (Protected)
		rooms := api.Group("/rooms", middleware.AuthMiddleware())
		{
			rooms.POST("", roomHandler.CreateRoom)
			rooms.POST("/with-tenant", roomHandler.CreateRoomWithTenant)
			rooms.GET("", roomHandler.GetRooms)
			rooms.GET("/:id", roomHandler.GetRoom)
			rooms.PUT("/:id", roomHandler.UpdateRoom)
			rooms.DELETE("/:id", roomHandler.DeleteRoom)
		}

		// Tenant routes (Protected)
		tenants := api.Group("/tenants", middleware.AuthMiddleware())
		{
			tenants.GET("/me", middleware.RoleMiddleware(dbPool, "tenant"), tenantHandler.GetMyTenantProfile)
			tenants.POST("", middleware.RoleMiddleware(dbPool, "owner"), tenantHandler.CreateTenant)
			tenants.GET("", middleware.RoleMiddleware(dbPool, "owner"), tenantHandler.GetTenants)
			tenants.GET("/:id", middleware.RoleMiddleware(dbPool, "owner"), tenantHandler.GetTenant)
			tenants.PUT("/:id", middleware.RoleMiddleware(dbPool, "owner"), tenantHandler.UpdateTenant)
			tenants.DELETE("/:id", middleware.RoleMiddleware(dbPool, "owner"), tenantHandler.DeleteTenant)
		}

		// Contract routes (Protected)
		contracts := api.Group("/contracts", middleware.AuthMiddleware())
		{
			contracts.POST("", contractHandler.CreateContract)
			contracts.GET("", contractHandler.GetContracts)
			contracts.GET("/:id", contractHandler.GetContract)
			contracts.PUT("/:id", contractHandler.UpdateContract)
			contracts.DELETE("/:id", contractHandler.DeleteContract)
		}

		// Payment routes (Protected)
		payments := api.Group("/payments", middleware.AuthMiddleware())
		{
			// Shared access (Owner & Tenant)
			payments.GET("/:id", paymentHandler.GetPayment)
			payments.GET("/:id/receipt", paymentHandler.GetReceiptHTML)

			// Owner only access
			payments.GET("", middleware.RoleMiddleware(dbPool, "owner"), paymentHandler.GetAllPayments)
			payments.POST("", middleware.RoleMiddleware(dbPool, "owner"), paymentHandler.CreatePaymentBill)
			payments.PUT("/:id/verify", middleware.RoleMiddleware(dbPool, "owner"), paymentHandler.VerifyPayment)

			// Tenant only access
			payments.GET("/my", middleware.RoleMiddleware(dbPool, "tenant"), paymentHandler.GetTenantPayments)
			payments.POST("/:id/submit", middleware.RoleMiddleware(dbPool, "tenant"), paymentHandler.SubmitPaymentProof)
		}

		// Calendar routes (Protected)
		calendar := api.Group("/calendar", middleware.AuthMiddleware())
		{
			calendar.GET("/events", middleware.RoleMiddleware(dbPool, "owner"), calendarHandler.GetEvents)
		}

		// Complaint routes (Protected)
		complaints := api.Group("/complaints", middleware.AuthMiddleware())
		{
			complaints.POST("", middleware.RoleMiddleware(dbPool, "tenant"), complaintHandler.CreateComplaint)
			complaints.POST("/upload", middleware.RoleMiddleware(dbPool, "tenant"), complaintHandler.UploadPhoto)
			complaints.GET("/my", middleware.RoleMiddleware(dbPool, "tenant"), complaintHandler.GetTenantComplaints)
			complaints.GET("", middleware.RoleMiddleware(dbPool, "owner"), complaintHandler.GetOwnerComplaints)
			complaints.PUT("/:id/status", middleware.RoleMiddleware(dbPool, "owner"), complaintHandler.UpdateComplaintStatus)
			complaints.PUT("/whatsapp-group", middleware.RoleMiddleware(dbPool, "owner"), complaintHandler.UpdateWhatsAppGroup)
		}
	}

	log.Printf("Server starting on port %s...", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatal("Unable to start server:", err)
	}
}
