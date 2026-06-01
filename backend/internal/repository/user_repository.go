package repository

import (
	"context"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepo interface {
	Create(ctx context.Context, user *model.User) error
	FindByEmail(ctx context.Context, email string) (*model.User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*model.User, error)
	FindByVerificationToken(ctx context.Context, token string) (*model.User, error)
	VerifyUser(ctx context.Context, id uuid.UUID) error
	SetOTP(ctx context.Context, email string, code string, expiresAt time.Time) error
	ResetPassword(ctx context.Context, email string, newPasswordHash string) error
	UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error
}

type UserRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, user *model.User) error {
	query := `INSERT INTO users (name, email, password_hash, role, verification_token) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`
	return r.db.QueryRow(ctx, query, user.Name, user.Email, user.PasswordHash, user.Role, user.VerificationToken).Scan(&user.ID, &user.CreatedAt)
}

func (r *UserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, verification_token, otp_code, otp_expires_at, whatsapp_group_link, created_at FROM users WHERE email = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, email).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role,
		&user.IsVerified, &user.VerificationToken, &user.OTPCode, &user.OTPExpiresAt, &user.WhatsAppGroupLink, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, whatsapp_group_link, created_at FROM users WHERE id = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.WhatsAppGroupLink, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) FindByVerificationToken(ctx context.Context, token string) (*model.User, error) {
	query := `SELECT id, name, email, password_hash, role, is_verified, created_at FROM users WHERE verification_token = $1`
	user := &model.User{}
	err := r.db.QueryRow(ctx, query, token).Scan(
		&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.Role, &user.IsVerified, &user.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return user, nil
}

func (r *UserRepository) VerifyUser(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *UserRepository) SetOTP(ctx context.Context, email string, code string, expiresAt time.Time) error {
	query := `UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3`
	_, err := r.db.Exec(ctx, query, code, expiresAt, email)
	return err
}

func (r *UserRepository) ResetPassword(ctx context.Context, email string, newPasswordHash string) error {
	query := `UPDATE users SET password_hash = $1, otp_code = NULL, otp_expires_at = NULL WHERE email = $2`
	_, err := r.db.Exec(ctx, query, newPasswordHash, email)
	return err
}

func (r *UserRepository) UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error {
	query := `UPDATE users SET whatsapp_group_link = $1 WHERE id = $2`
	_, err := r.db.Exec(ctx, query, link, id)
	return err
}
