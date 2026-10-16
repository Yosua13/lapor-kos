package cron

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/redis"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BillingCron struct {
	db          *pgxpool.Pool
	repo        *repository.InvoiceRepository
	redisClient *redis.Client
}

func NewBillingCron(db *pgxpool.Pool, redisClient ...*redis.Client) *BillingCron {
	var rc *redis.Client
	if len(redisClient) > 0 {
		rc = redisClient[0]
	}
	return &BillingCron{db: db, repo: repository.NewInvoiceRepository(db), redisClient: rc}
}

// WithRedis associates a Redis client for distributed multi-instance locking.
func (c *BillingCron) WithRedis(rc *redis.Client) *BillingCron {
	c.redisClient = rc
	return c
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
		lockKey := fmt.Sprintf("billing:scheduled:%s:%s", propertyID, now.Format("2006-01-02"))
		lockVal := uuid.NewString()

		acquired, lockErr := redis.AcquireDistributedLock(ctx, c.redisClient, lockKey, lockVal, 10*time.Minute)
		if lockErr != nil {
			log.Printf("[BILLING] distributed lock warning for property %s: %v (falling back to local run)", propertyID, lockErr)
		} else if !acquired {
			log.Printf("[BILLING] property %s billing is currently locked by another worker instance, skipping", propertyID)
			continue
		}

		if _, err = c.repo.Generate(ctx, propertyID, period, "schedule", runKey, nil, false); err != nil {
			log.Printf("[BILLING] property %s: %v", propertyID, err)
		}

		_ = redis.ReleaseDistributedLock(ctx, c.redisClient, lockKey, lockVal)
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
		lockKey := fmt.Sprintf("billing:manual:%s:%s", propertyID, now.Format("2006-01-02"))
		lockVal := uuid.NewString()

		acquired, lockErr := redis.AcquireDistributedLock(ctx, c.redisClient, lockKey, lockVal, 5*time.Minute)
		if lockErr != nil {
			log.Printf("[BILLING] manual trigger lock warning for property %s: %v", propertyID, lockErr)
		} else if !acquired {
			log.Printf("[BILLING] property %s billing manual trigger is locked by another instance, skipping", propertyID)
			continue
		}

		result, generateErr := c.repo.Generate(ctx, propertyID, now, "manual", "ops:"+uuid.NewString(), nil, true)
		_ = redis.ReleaseDistributedLock(ctx, c.redisClient, lockKey, lockVal)
		if generateErr != nil {
			return nil, generateErr
		}
		results = append(results, *result)
	}
	return results, rows.Err()
}

func (c *BillingCron) TriggerProperty(ctx context.Context, propertyID, actorID uuid.UUID, period time.Time) (*model.BillingJobResult, error) {
	lockKey := fmt.Sprintf("billing:property:%s:%s", propertyID, period.Format("2006-01"))
	lockVal := uuid.NewString()

	acquired, _ := redis.AcquireDistributedLock(ctx, c.redisClient, lockKey, lockVal, 5*time.Minute)
	if !acquired {
		return nil, fmt.Errorf("billing job for property %s is currently locked by another process", propertyID)
	}
	defer func() {
		_ = redis.ReleaseDistributedLock(ctx, c.redisClient, lockKey, lockVal)
	}()

	return c.repo.Generate(ctx, propertyID, period, "manual", "manual:"+uuid.NewString(), &actorID, true)
}
