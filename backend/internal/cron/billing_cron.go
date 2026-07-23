package cron

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingCron struct {
	db *pgxpool.Pool
}

func NewBillingCron(db *pgxpool.Pool) *BillingCron {
	return &BillingCron{db: db}
}

func (c *BillingCron) Start() {
	// Run immediately on start (optional, but good for testing)
	c.processMonthlyBills()

	// Then run every 24 hours (or you can use github.com/robfig/cron/v3 for exact times)
	ticker := time.NewTicker(24 * time.Hour)
	go func() {
		for range ticker.C {
			c.processMonthlyBills()
		}
	}()
}

// Trigger allows manual execution of the billing cron check
func (c *BillingCron) Trigger() {
	c.processMonthlyBills()
}

func (c *BillingCron) processMonthlyBills() {
	log.Println("[CRON] Starting processMonthlyBills check...")
	ctx := context.Background()

	// Get all active contracts that are paid monthly
	query := `
		SELECT id, property_id, owner_id, monthly_rent, electricity_bill, water_bill, other_bills, payment_due_day
		FROM contracts 
		WHERE status = 'active' AND payment_interval = 'monthly'
	`
	rows, err := c.db.Query(ctx, query)
	if err != nil {
		log.Printf("[CRON] Failed to fetch active contracts: %v", err)
		return
	}
	defer rows.Close()

	now := time.Now()
	currentMonth := int(now.Month())
	currentYear := now.Year()

	for rows.Next() {
		var contractID, propertyID, ownerID uuid.UUID
		var monthlyRent, electricityBill, waterBill, otherBills float64
		var paymentDueDay int

		err := rows.Scan(&contractID, &propertyID, &ownerID, &monthlyRent, &electricityBill, &waterBill, &otherBills, &paymentDueDay)
		if err != nil {
			log.Printf("[CRON] Row scan error: %v", err)
			continue
		}

		// The database uniqueness constraint is the concurrency boundary. An
		// atomic INSERT avoids the race in the old SELECT EXISTS + INSERT flow.
		dueDate := time.Date(currentYear, now.Month(), paymentDueDay, 23, 59, 59, 0, now.Location())
		insertQuery := `
			INSERT INTO payments (
				id, property_id, contract_id, owner_id, period_month, period_year,
				amount_rent, amount_electricity, amount_water, amount_other,
				total_paid, status, due_date, notes
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
			ON CONFLICT (contract_id, period_month, period_year) DO NOTHING`
		paymentID := uuid.New()
		tag, err := c.db.Exec(ctx, insertQuery,
			paymentID, propertyID, contractID, ownerID, currentMonth, currentYear,
			monthlyRent, electricityBill, waterBill, otherBills,
			0, "unpaid", dueDate, "Tagihan bulanan otomatis dibuat sistem.",
		)
		if err != nil {
			log.Printf("[CRON] Failed to create automated bill for property %s contract %s: %v", propertyID, contractID, err)
		} else if tag.RowsAffected() > 0 {
			log.Printf("[CRON] Successfully created bill for property %s contract %s, Period: %d-%d", propertyID, contractID, currentMonth, currentYear)
		}
	}

	log.Println("[CRON] Finished processMonthlyBills check.")
}
