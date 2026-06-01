package handler

import (
	"crypto/rand"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/repository"
	"github.com/Yosua13/lapor-kos/backend/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	repo      repository.UserRepo
	emailServ service.EmailServiceInterface
}

func NewAuthHandler(repo repository.UserRepo, emailServ service.EmailServiceInterface) *AuthHandler {
	return &AuthHandler{repo: repo, emailServ: emailServ}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req model.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	token := uuid.New().String()
	user := &model.User{
		Name:              req.Name,
		Email:             req.Email,
		PasswordHash:      string(hashedPassword),
		Role:              "owner",
		VerificationToken: &token,
	}

	if err := h.repo.Create(c.Request.Context(), user); err != nil {
		log.Printf("Error creating user: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Send verification email
	_ = h.emailServ.SendVerificationEmail(user.Email, token)

	c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully. Please check your email for verification.", "user": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req model.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if !user.IsVerified {
		c.JSON(http.StatusForbidden, gin.H{"error": "Please verify your email before logging in."})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token, err := h.generateToken(user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, model.AuthResponse{
		User:  *user,
		Token: token,
	})
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Verification token is required"})
		return
	}

	user, err := h.repo.FindByVerificationToken(c.Request.Context(), token)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invalid or expired verification token"})
		return
	}

	if err := h.repo.VerifyUser(c.Request.Context(), user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email verified successfully. You can now login."})
}

func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req model.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil {
		// Don't reveal if email exists or not for security, but here we'll just return success to mock
		c.JSON(http.StatusOK, gin.H{"message": "If your email is registered, you will receive an OTP code."})
		return
	}

	otp := generateOTP(6)
	expiresAt := time.Now().Add(10 * time.Minute)

	if err := h.repo.SetOTP(c.Request.Context(), user.Email, otp, expiresAt); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to set OTP"})
		return
	}

	_ = h.emailServ.SendOTPEmail(user.Email, otp)

	c.JSON(http.StatusOK, gin.H{"message": "OTP sent to your email."})
}

func (h *AuthHandler) VerifyOTP(c *gin.Context) {
	var req model.VerifyOTPRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil || user.OTPCode == nil || *user.OTPCode != req.OTP || user.OTPExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "OTP verified successfully."})
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req model.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByEmail(c.Request.Context(), req.Email)
	if err != nil || user.OTPCode == nil || *user.OTPCode != req.OTP || user.OTPExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired OTP"})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	if err := h.repo.ResetPassword(c.Request.Context(), user.Email, string(hashedPassword)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password reset successfully. You can now login."})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	user, err := h.repo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req model.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify user exists
	_, err = h.repo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Save to DB
	if err := h.repo.UpdateProfile(c.Request.Context(), userID, req.Name, req.Email, req.Phone); err != nil {
		log.Printf("Error updating profile: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Profile updated successfully"})
}

func (h *AuthHandler) UpdatePassword(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req model.UpdatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.repo.FindByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Kata sandi saat ini salah"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash new password"})
		return
	}

	// Save to DB
	if err := h.repo.UpdatePassword(c.Request.Context(), userID, string(hashedPassword)); err != nil {
		log.Printf("Error updating password: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password updated successfully"})
}

func (h *AuthHandler) generateToken(userID string) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "your-very-secret-key"
	}

	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(time.Hour * 24 * 30).Unix(), // 30 days for token
		"iat": time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func generateOTP(n int) string {
	const digits = "0123456789"
	result := make([]byte, n)
	for i := 0; i < n; i++ {
		num, _ := rand.Int(rand.Reader, big.NewInt(int64(len(digits))))
		result[i] = digits[num.Int64()]
	}
	return string(result)
}
