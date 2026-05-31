package model

import (
	"time"

	"github.com/google/uuid"
)

type Payment struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	ContractID        uuid.UUID  `json:"contract_id" db:"contract_id"`
	OwnerID           *uuid.UUID `json:"owner_id,omitempty" db:"owner_id"`
	PeriodMonth       int        `json:"period_month" db:"period_month"`
	PeriodYear        int        `json:"period_year" db:"period_year"`
	AmountRent        float64    `json:"amount_rent" db:"amount_rent"`
	AmountElectricity float64    `json:"amount_electricity" db:"amount_electricity"`
	AmountWater       float64    `json:"amount_water" db:"amount_water"`
	AmountOther       float64    `json:"amount_other" db:"amount_other"`
	TotalPaid         float64    `json:"total_paid" db:"total_paid"`
	PaymentMethod     string     `json:"payment_method" db:"payment_method"`
	Status            string     `json:"status" db:"status"` // unpaid, pending, paid, partial, overdue
	ProofPhotoURL     string     `json:"proof_photo_url" db:"proof_photo_url"`
	PaidAt            *time.Time `json:"paid_at" db:"paid_at"`
	DueDate           time.Time  `json:"due_date" db:"due_date"`
	Notes             string     `json:"notes" db:"notes"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`

	// Preloaded data
	Contract *Contract `json:"contract,omitempty"`
}

type SubmitPaymentRequest struct {
	PaymentMethod string  `form:"payment_method" binding:"required"`
	TotalPaid     float64 `form:"total_paid" binding:"required"`
	Notes         string  `form:"notes"`
}

type VerifyPaymentRequest struct {
	AmountRent        float64 `json:"amount_rent"`
	AmountElectricity float64 `json:"amount_electricity"`
	AmountWater       float64 `json:"amount_water"`
	AmountOther       float64 `json:"amount_other"`
	TotalPaid         float64 `json:"total_paid" binding:"required"`
	Status            string  `json:"status" binding:"required"` // paid, partial, unpaid, overdue
	Notes             string  `json:"notes"`
}
