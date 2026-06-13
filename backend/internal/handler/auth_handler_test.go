package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/crypto/bcrypt"
)

// MockUserRepository is a mock implementation of UserRepo
type MockUserRepository struct {
	mock.Mock
}

func (m *MockUserRepository) Create(ctx context.Context, user *model.User) error {
	args := m.Called(ctx, user)
	return args.Error(0)
}

func (m *MockUserRepository) FindByEmail(ctx context.Context, email string) (*model.User, error) {
	args := m.Called(ctx, email)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) FindByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) FindByVerificationToken(ctx context.Context, token string) (*model.User, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.User), args.Error(1)
}

func (m *MockUserRepository) VerifyUser(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockUserRepository) SetOTP(ctx context.Context, email string, code string, expiresAt time.Time) error {
	args := m.Called(ctx, email, code, expiresAt)
	return args.Error(0)
}

func (m *MockUserRepository) ResetPassword(ctx context.Context, email string, newPasswordHash string) error {
	args := m.Called(ctx, email, newPasswordHash)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateWhatsAppGroupLink(ctx context.Context, id uuid.UUID, link string) error {
	args := m.Called(ctx, id, link)
	return args.Error(0)
}

func (m *MockUserRepository) UpdateProfile(ctx context.Context, id uuid.UUID, name string, email string, phone string) error {
	args := m.Called(ctx, id, name, email, phone)
	return args.Error(0)
}

func (m *MockUserRepository) UpdatePassword(ctx context.Context, id uuid.UUID, newPasswordHash string) error {
	args := m.Called(ctx, id, newPasswordHash)
	return args.Error(0)
}

func (m *MockUserRepository) GetTenantProfile(ctx context.Context, id uuid.UUID) (map[string]interface{}, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockUserRepository) UpdateTenantProfile(ctx context.Context, id uuid.UUID, name string, phone string, roomIDStr string, entryDateStr string, rentalDuration int, ktpURL *string, selfieURL *string) error {
	args := m.Called(ctx, id, name, phone, roomIDStr, entryDateStr, rentalDuration, ktpURL, selfieURL)
	return args.Error(0)
}

func (m *MockUserRepository) DeleteTenant(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}



// MockEmailService is a mock implementation of EmailServiceInterface
type MockEmailService struct {
	mock.Mock
}

func (m *MockEmailService) SendVerificationEmail(email string, token string) error {
	args := m.Called(email, token)
	return args.Error(0)
}

func (m *MockEmailService) SendOTPEmail(email string, otp string) error {
	args := m.Called(email, otp)
	return args.Error(0)
}

func TestRegister(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailService)
		h := NewAuthHandler(mockRepo, mockEmail, nil)

		reqBody := model.RegisterRequest{
			Name:     "Test User",
			Email:    "test@example.com",
			Password: "password123",
		}
		jsonBody, _ := json.Marshal(reqBody)

		mockRepo.On("Create", mock.Anything, mock.AnythingOfType("*model.User")).Return(nil)
		mockEmail.On("SendVerificationEmail", "test@example.com", mock.Anything).Return(nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Register(c)

		assert.Equal(t, http.StatusCreated, w.Code)
		var response map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &response)
		assert.Contains(t, response["message"], "registered successfully")
	})

	t.Run("Duplicate Email", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailService)
		h := NewAuthHandler(mockRepo, mockEmail, nil)

		reqBody := model.RegisterRequest{
			Name:     "Test User",
			Email:    "test@example.com",
			Password: "password123",
		}
		jsonBody, _ := json.Marshal(reqBody)

		mockRepo.On("Create", mock.Anything, mock.Anything).Return(errors.New("duplicate email"))

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/register", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Register(c)

		assert.Equal(t, http.StatusInternalServerError, w.Code)
	})
}

func TestLogin(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		h := NewAuthHandler(mockRepo, nil, nil)

		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
		user := &model.User{
			ID:           uuid.New(),
			Email:        "test@example.com",
			PasswordHash: string(hashedPassword),
			IsVerified:   true,
		}

		mockRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)

		reqBody := model.LoginRequest{
			Email:    "test@example.com",
			Password: "password123",
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Login(c)

		assert.Equal(t, http.StatusOK, w.Code)
		var resp model.AuthResponse
		json.Unmarshal(w.Body.Bytes(), &resp)
		assert.NotEmpty(t, resp.Token)
	})

	t.Run("Unverified", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		h := NewAuthHandler(mockRepo, nil, nil)

		user := &model.User{
			Email:      "test@example.com",
			IsVerified: false,
		}

		mockRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)

		reqBody := model.LoginRequest{
			Email:    "test@example.com",
			Password: "password123",
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/login", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.Login(c)

		assert.Equal(t, http.StatusForbidden, w.Code)
	})
}

func TestVerifyEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		h := NewAuthHandler(mockRepo, nil, nil)

		user := &model.User{ID: uuid.New()}
		mockRepo.On("FindByVerificationToken", mock.Anything, "valid-token").Return(user, nil)
		mockRepo.On("VerifyUser", mock.Anything, user.ID).Return(nil)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/verify-email?token=valid-token", nil)

		h.VerifyEmail(c)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestForgotPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		mockEmail := new(MockEmailService)
		h := NewAuthHandler(mockRepo, mockEmail, nil)

		user := &model.User{Email: "test@example.com"}
		mockRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)
		mockRepo.On("SetOTP", mock.Anything, "test@example.com", mock.Anything, mock.Anything).Return(nil)
		mockEmail.On("SendOTPEmail", "test@example.com", mock.Anything).Return(nil)

		reqBody := model.ForgotPasswordRequest{Email: "test@example.com"}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/forgot-password", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.ForgotPassword(c)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestVerifyOTP(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		h := NewAuthHandler(mockRepo, nil, nil)

		otp := "123456"
		expiresAt := time.Now().Add(10 * time.Minute)
		user := &model.User{
			Email:        "test@example.com",
			OTPCode:      &otp,
			OTPExpiresAt: &expiresAt,
		}

		mockRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)

		reqBody := model.VerifyOTPRequest{
			Email: "test@example.com",
			OTP:   "123456",
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/verify-otp", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.VerifyOTP(c)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}

func TestResetPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockRepo := new(MockUserRepository)
		h := NewAuthHandler(mockRepo, nil, nil)

		otp := "123456"
		expiresAt := time.Now().Add(10 * time.Minute)
		user := &model.User{
			Email:        "test@example.com",
			OTPCode:      &otp,
			OTPExpiresAt: &expiresAt,
		}

		mockRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)
		mockRepo.On("ResetPassword", mock.Anything, "test@example.com", mock.Anything).Return(nil)

		reqBody := model.ResetPasswordRequest{
			Email:       "test@example.com",
			OTP:         "123456",
			NewPassword: "newpassword123",
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("POST", "/reset-password", bytes.NewBuffer(jsonBody))
		c.Request.Header.Set("Content-Type", "application/json")

		h.ResetPassword(c)

		assert.Equal(t, http.StatusOK, w.Code)
	})
}
