package model

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID                       uuid.UUID  `json:"id" db:"id"`
	Name                     string     `json:"name" db:"name"`
	Email                    string     `json:"email" db:"email"`
	PasswordHash             string     `json:"-" db:"password_hash"`
	Role                     string     `json:"role" db:"role"`
	IsVerified               bool       `json:"is_verified" db:"is_verified"`
	VerificationToken        *string    `json:"-" db:"verification_token"`
	OTPCode                  *string    `json:"-" db:"otp_code"`
	OTPExpiresAt             *time.Time `json:"-" db:"otp_expires_at"`
	WhatsAppGroupLink        *string    `json:"whatsapp_group_link,omitempty" db:"whatsapp_group_link"`
	Phone                    string     `json:"phone" db:"phone"`
	KtpURL                   *string    `json:"ktp_url,omitempty" db:"ktp_url"`
	SelfieURL                *string    `json:"selfie_url,omitempty" db:"selfie_url"`
	IsActive                 bool       `json:"is_active" db:"is_active"`
	DateOfBirth              *time.Time `json:"date_of_birth,omitempty" db:"date_of_birth"`
	Gender                   *string    `json:"gender,omitempty" db:"gender"`
	Job                      *string    `json:"job,omitempty" db:"job"`
	EmergencyContactPhone    *string    `json:"emergency_contact_phone,omitempty" db:"emergency_contact_phone"`
	EmergencyContactRelation *string    `json:"emergency_contact_relation,omitempty" db:"emergency_contact_relation"`
	EmergencyContactName     *string    `json:"emergency_contact_name,omitempty" db:"emergency_contact_name"`
	AdditionalDocURL         *string    `json:"additional_doc_url,omitempty" db:"additional_doc_url"`
	DefaultPropertyName      string     `json:"-" db:"-"`
	CreatedAt                time.Time  `json:"created_at" db:"created_at"`
}

type RegisterRequest struct {
	Name         string `json:"name" binding:"required"`
	Email        string `json:"email" binding:"required,email"`
	Password     string `json:"password" binding:"required,min=8"`
	PropertyName string `json:"property_name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	User  User   `json:"user"`
	Token string `json:"token"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type VerifyOTPRequest struct {
	Email string `json:"email" binding:"required,email"`
	OTP   string `json:"otp" binding:"required,len=6"`
}

type ResetPasswordRequest struct {
	Email       string `json:"email" binding:"required,email"`
	OTP         string `json:"otp" binding:"required,len=6"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type UpdateProfileRequest struct {
	Name  string `json:"name" binding:"required"`
	Email string `json:"email" binding:"required,email"`
	Phone string `json:"phone"`
}

type UpdatePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required,min=8"`
}
