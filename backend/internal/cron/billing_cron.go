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
		SELECT id, owner_id, monthly_rent, electricity_bill, water_bill, other_bills, payment_due_day 
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
		var contractID, ownerID uuid.UUID
		var monthlyRent, electricityBill, waterBill, otherBills float64
		var paymentDueDay int

		err := rows.Scan(&contractID, &ownerID, &monthlyRent, &electricityBill, &waterBill, &otherBills, &paymentDueDay)
		if err != nil {
			log.Printf("[CRON] Row scan error: %v", err)
			continue
		}

		// Check if payment for current month and year already exists
		var exists bool
		checkQuery := `
			SELECT EXISTS(
				SELECT 1 FROM payments 
				WHERE contract_id = $1 AND period_month = $2 AND period_year = $3
			)
		`
		err = c.db.QueryRow(ctx, checkQuery, contractID, currentMonth, currentYear).Scan(&exists)
		if err != nil {
			log.Printf("[CRON] Failed to check existing payment: %v", err)
			continue
		}

		if !exists {
			// Generate due date based on payment_due_day (e.g., the 5th of this month)
			dueDate := time.Date(currentYear, now.Month(), paymentDueDay, 23, 59, 59, 0, now.Location())
			
			// If payment_due_day is in the past (e.g. today is 10th but due is 5th), it means the bill is already overdue upon creation, or we can just leave it as is.
			// Usually, cron creates it a few days *before* the month starts, but since we run this daily, we'll just insert it.
			
			insertQuery := `
				INSERT INTO payments (
					id, contract_id, owner_id, period_month, period_year, 
					amount_rent, amount_electricity, amount_water, amount_other, 
					total_paid, status, due_date, notes
				) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			`
			paymentID := uuid.New()
			_, err = c.db.Exec(ctx, insertQuery, 
				paymentID, contractID, ownerID, currentMonth, currentYear,
				monthlyRent, electricityBill, waterBill, otherBills,
				0, "unpaid", dueDate, "Tagihan bulanan otomatis dibuat sistem.",
			)
			if err != nil {
				log.Printf("[CRON] Failed to create automated bill for contract %s: %v", contractID, err)
			} else {
				log.Printf("[CRON] Successfully created bill for contract %s, Period: %d-%d", contractID, currentMonth, currentYear)
			}
		}
	}

	log.Println("[CRON] Finished processMonthlyBills check.")
}
