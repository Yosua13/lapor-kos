package main

import (
	"context"
	"log"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/Yosua13/lapor-kos/backend/internal/database"
	"github.com/Yosua13/lapor-kos/backend/internal/httpapi"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/rabbitmq"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/redis"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found; using system environment variables")
	}

	appConfig, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	db, err := database.Open(context.Background(), appConfig.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	// Initialize optional Redis client (graceful degradation)
	redisClient, err := redis.NewClient(appConfig.Redis)
	if err != nil {
		log.Printf("[REDIS] Initialization error: %v", err)
	}
	if redisClient != nil {
		defer redisClient.Close()
	}

	// Initialize optional RabbitMQ connection (graceful degradation)
	rabbitConn, err := rabbitmq.NewConnection(appConfig.RabbitMQ)
	if err != nil {
		log.Printf("[RABBITMQ] Initialization error: %v", err)
	}
	if rabbitConn != nil {
		defer rabbitConn.Close()
		if rabbitConn.IsConnected() {
			if err := rabbitConn.DeclareTopology(); err != nil {
				log.Printf("[RABBITMQ] Topology declaration warning: %v", err)
			}
		}
	}

	billingCron := cron.NewBillingCron(db)
	router, err := httpapi.NewRouter(db, billingCron, appConfig.TrustedProxies, httpapi.RouterOptions{
		RedisClient: redisClient,
		RabbitMQ:    rabbitConn,
	})
	if err != nil {
		log.Fatalf("configure HTTP router: %v", err)
	}

	// Schema changes are intentionally absent here. Apply the versioned SQL
	// migrations before deployment, then start background jobs.
	billingCron.Start()
	log.Printf("Server starting on port %s", appConfig.Port)
	if err := router.Run(":" + appConfig.Port); err != nil {
		log.Fatalf("start HTTP server: %v", err)
	}
}
