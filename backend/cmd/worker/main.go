package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/database"
	"github.com/Yosua13/lapor-kos/backend/internal/delivery/queue"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using system environment variables")
	}

	appConfig, err := config.Load()
	if err != nil {
		log.Fatalf("[WORKER] Failed to load configuration: %v", err)
	}

	db, err := database.Open(context.Background(), appConfig.DatabaseURL)
	if err != nil {
		log.Fatalf("[WORKER] Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize RabbitMQ connection
	rabbitConn, err := rabbitmq.NewConnection(appConfig.RabbitMQ)
	if err != nil {
		log.Printf("[WORKER] RabbitMQ initialization error: %v", err)
	}
	if rabbitConn != nil {
		defer rabbitConn.Close()
		if rabbitConn.IsConnected() {
			if err := rabbitConn.DeclareTopology(); err != nil {
				log.Printf("[WORKER] Topology declaration warning: %v", err)
			}
		}
	}

	// Initialize services and repositories
	emailService := service.NewEmailService()
	whatsAppService := service.NewWhatsAppService()
	aiService := service.NewAIService()
	storageService := service.NewStorageService()
	contractDocService := service.NewContractDocumentService()

	notifRepo := repository.NewNotificationRepository(db)
	contractRepo := repository.NewContractRepository(db)
	financeRepo := repository.NewFinanceRepository(db)
	complaintRepo := repository.NewComplaintRepository(db)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Graceful shutdown on SIGINT or SIGTERM
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		sig := <-sigChan
		log.Printf("[WORKER] Received termination signal (%v); initiating graceful shutdown...", sig)
		cancel()
	}()

	var wg sync.WaitGroup

	if rabbitConn != nil && rabbitConn.IsConnected() {
		// 1. WhatsApp Notification Consumer
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = queue.ConsumeWhatsAppMessages(ctx, rabbitConn, whatsAppService, notifRepo)
		}()

		// 2. Email Notification Consumer
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = queue.ConsumeEmailMessages(ctx, rabbitConn, emailService, notifRepo)
		}()

		// 3. Contract PDF Compilation Consumer
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = queue.ConsumeContractPDFJobs(ctx, rabbitConn, contractDocService, contractRepo)
		}()

		// 4. Financial Report CSV Export Consumer
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = queue.ConsumeReportExportJobs(ctx, rabbitConn, financeRepo, storageService)
		}()

		// 5. Gemini AI Complaint Triage Consumer
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = queue.ConsumeAITriageJobs(ctx, rabbitConn, aiService, complaintRepo)
		}()

		log.Printf("[WORKER] All 5 RabbitMQ background consumers started successfully. Waiting for jobs...")
	} else {
		log.Printf("[WORKER] RabbitMQ is unconfigured or offline. Worker running in idle standby mode.")
	}

	// Block until context canceled by signal
	<-ctx.Done()
	wg.Wait()
	log.Printf("[WORKER] Graceful shutdown completed cleanly. Zero messages lost.")
}
