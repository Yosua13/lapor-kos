package main

import (
	"context"
	"log"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/cron"
	"github.com/Yosua13/lapor-kos/backend/internal/database"
	"github.com/Yosua13/lapor-kos/backend/internal/httpapi"
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

	billingCron := cron.NewBillingCron(db)
	router, err := httpapi.NewRouter(db, billingCron, appConfig.TrustedProxies)
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
