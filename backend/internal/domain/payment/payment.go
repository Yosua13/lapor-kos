package payment

import (
	"github.com/Yosua13/lapor-kos/backend/internal/model"
)

type Payment = model.Payment
type PaymentProof = model.PaymentProof
type SubmitPaymentRequest = model.SubmitPaymentRequest
type VerifyPaymentRequest = model.VerifyPaymentRequest
type PaymentWebhookPayload = model.PaymentWebhookPayload

const (
	StatusUnpaid    = "unpaid"
	StatusPending   = "pending"
	StatusPaid      = "paid"
	StatusPartial   = "partial"
	StatusOverdue   = "overdue"
	StatusRejected  = "rejected"
	StatusRefunded  = "refunded"
	StatusVoid      = "void"
	StatusCompleted = "completed"
)
