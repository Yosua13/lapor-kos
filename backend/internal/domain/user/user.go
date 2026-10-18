package user

import (
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type User = model.User

const (
	RoleOwner  = "owner"
	RoleTenant = "tenant"
	RoleStaff  = "staff"
)

type UpdateProfileInput struct {
	Name             string `json:"name"`
	Phone            string `json:"phone"`
	EmergencyContact string `json:"emergency_contact"`
}

type ResetPasswordInput struct {
	Email           string `json:"email"`
	NewPasswordHash string `json:"new_password_hash"`
}

type SetOTPInput struct {
	Email  string    `json:"email"`
	OTP    string    `json:"otp"`
	Expiry time.Time `json:"expiry"`
}
