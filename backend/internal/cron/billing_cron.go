package cron

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingCron struct {
	db   *pgxpool.Pool
	repo *repository.InvoiceRepository
}

func NewBillingCron(db *pgxpool.Pool) *BillingCron {
	return &BillingCron{db: db, repo: repository.NewInvoiceRepository(db)}
}

func (c *BillingCron) Start() {
	if c.db == nil {
		return
	}
	go c.runScheduled(context.Background())
	ticker := time.NewTicker(time.Hour)
	go func() {
		for range ticker.C {
			c.runScheduled(context.Background())
		}
	}()
}

func (c *BillingCron) runScheduled(ctx context.Context) {
	if c.db == nil {
		return
	}
	rows, err := c.db.Query(ctx, `SELECT property_id,timezone FROM billing_policies`)
	if err != nil {
		log.Printf("[BILLING] load policies: %v", err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var propertyID uuid.UUID
		var timezone string
		if err = rows.Scan(&propertyID, &timezone); err != nil {
			log.Printf("[BILLING] scan policy: %v", err)
			continue
		}
		loc, locationErr := time.LoadLocation(timezone)
		if locationErr != nil {
			log.Printf("[BILLING] invalid timezone for property %s: %v", propertyID, locationErr)
			continue
		}
		now := time.Now().In(loc)
		period := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
		runKey := fmt.Sprintf("schedule:%s", now.Format("2006-01-02"))
		if _, err = c.repo.Generate(ctx, propertyID, period, "schedule", runKey, nil, false); err != nil {
			log.Printf("[BILLING] property %s: %v", propertyID, err)
		}
	}
}

func (c *BillingCron) Trigger(ctx context.Context) ([]model.BillingJobResult, error) {
	if c.db == nil {
		return nil, nil
	}
	rows, err := c.db.Query(ctx, `SELECT property_id,timezone FROM billing_policies`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := make([]model.BillingJobResult, 0)
	for rows.Next() {
		var propertyID uuid.UUID
		var timezone string
		if err = rows.Scan(&propertyID, &timezone); err != nil {
			return nil, err
		}
		loc, locationErr := time.LoadLocation(timezone)
		if locationErr != nil {
			return nil, locationErr
		}
		now := time.Now().In(loc)
		result, generateErr := c.repo.Generate(ctx, propertyID, now, "manual", "ops:"+uuid.NewString(), nil, true)
		if generateErr != nil {
			return nil, generateErr
		}
		results = append(results, *result)
	}
	return results, rows.Err()
}

func (c *BillingCron) TriggerProperty(ctx context.Context, propertyID, actorID uuid.UUID, period time.Time) (*model.BillingJobResult, error) {
	return c.repo.Generate(ctx, propertyID, period, "manual", "manual:"+uuid.NewString(), &actorID, true)
}
