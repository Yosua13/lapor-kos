package payment

import (
	"context"

	"github.com/google/uuid"
)

// Repository defines the contract for payment persistence.
type Repository interface {
	Create(ctx context.Context, p *Payment) error
	FindByID(ctx context.Context, id, propertyID uuid.UUID) (*Payment, error)
	FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*Payment, error)
	FindAll(ctx context.Context, propertyID uuid.UUID, filterStatus string, filterMonth int, filterYear int, contractIDStr string, userIDStr string) ([]Payment, error)
	FindByUserID(ctx context.Context, userID uuid.UUID) ([]Payment, error)
	Update(ctx context.Context, propertyID uuid.UUID, p *Payment) (*Payment, error)
	SubmitProof(ctx context.Context, id, userID uuid.UUID, proofURL string, method string, totalPaid float64, notes string) error
	VerifyPaymentTx(ctx context.Context, propertyID, actorID, paymentID uuid.UUID, req VerifyPaymentRequest) (*Payment, error)
	GetReceipt(ctx context.Context, propertyID, paymentID uuid.UUID) (*PaymentReceipt, error)
	GetReceiptForUser(ctx context.Context, userID, paymentID uuid.UUID) (*PaymentReceipt, error)
	GetReconciliationReport(ctx context.Context, propertyID uuid.UUID, startDate, endDate string) (*ReconciliationReport, error)
	CreateRefund(ctx context.Context, propertyID, actorID uuid.UUID, req CreateRefundRequestPayload) (*RefundRequest, error)
	ProcessRefund(ctx context.Context, propertyID, actorID, refundID uuid.UUID, req ProcessRefundPayload) (*RefundRequest, error)
}
