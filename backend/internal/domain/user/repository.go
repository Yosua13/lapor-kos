package user

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, u *User) error
	FindByEmail(ctx context.Context, email string) (*User, error)
	FindByID(ctx context.Context, id uuid.UUID) (*User, error)
	FindByVerificationToken(ctx context.Context, token string) (*User, error)
	IsUserActive(ctx context.Context, id uuid.UUID) (bool, error)
	VerifyUser(ctx context.Context, id uuid.UUID) error
	SetOTP(ctx context.Context, email, otp string, expiry time.Time) error
	ResetPassword(ctx context.Context, email, newPasswordHash string) error
	UpdateProfile(ctx context.Context, id uuid.UUID, name, phone, emergencyContact string) error
	UpdatePassword(ctx context.Context, id uuid.UUID, newPasswordHash string) error
	GetTenantProfile(ctx context.Context, propertyID, tenantID uuid.UUID) (map[string]any, error)
	DeleteTenant(ctx context.Context, propertyID, tenantID uuid.UUID) error
}
