package user_test

import (
	"context"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/user"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, u *user.User) error {
	args := m.Called(ctx, u)
	return args.Error(0)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*user.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*user.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) FindByVerificationToken(ctx context.Context, token string) (*user.User, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*user.User), args.Error(1)
}

func (m *MockUserRepository) IsUserActive(ctx context.Context, id uuid.UUID) (bool, error) {
	args := m.Called(ctx, id)
	return args.Bool(0), args.Error(1)
}

func (m *MockUserRepository) VerifyUser(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) SetOTP(ctx context.Context, email, otp string, expiry time.Time) error {
	args := m.Called(ctx, email, otp, expiry)
	return args.Error(0)
}

func (m *MockUserRepository) ResetPassword(ctx context.Context, email, newPasswordHash string) error {
	args := m.Called(ctx, email, newPasswordHash)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateProfile(ctx context.Context, id uuid.UUID, name, phone, emergencyContact string) error {
	args := m.Called(ctx, id, name, phone, emergencyContact)
	return args.Error(0)
}

func (m *MockUserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, newPasswordHash string) error {
	args := m.Called(ctx, id, newPasswordHash)
	return args.Error(0)
}

func (m *MockUserRepository) GetTenantProfile(ctx context.Context, propertyID, tenantID uuid.UUID) (map[string]any, error) {
	args := m.Called(ctx, propertyID, tenantID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]any), args.Error(1)
}

func (m *MockUserRepository) DeleteTenant(ctx context.Context, propertyID, tenantID uuid.UUID) error {
	args := m.Called(ctx, propertyID, tenantID)
	return args.Error(0)
}
