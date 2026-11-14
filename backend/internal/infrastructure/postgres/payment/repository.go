package payment

import (
	domainpayment "github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Ensure Repository implements the hexagonal outbound ports.
var (
	_ domainpayment.Repository                = (*Repository)(nil)
	_ domainpayment.MidtransWebhookRepository = (*Repository)(nil)
)

// Repository implements domain/payment.Repository using PostgreSQL.
type Repository struct {
	*repository.PaymentRepository
	db *pgxpool.Pool
}

// NewRepository creates a new PostgreSQL payment repository adapter.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{
		PaymentRepository: repository.NewPaymentRepository(db),
		db:                db,
	}
}

// DB returns the underlying database connection pool.
func (r *Repository) DB() *pgxpool.Pool {
	return r.db
}

