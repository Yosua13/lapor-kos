package finance

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository implements domain/finance.Repository using PostgreSQL.
type Repository struct {
	db *pgxpool.Pool
}

// NewRepository creates a new PostgreSQL finance repository.
func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// DB returns the underlying database connection pool.
func (r *Repository) DB() *pgxpool.Pool {
	return r.db
}
