package payment

import (
	"context"
	"errors"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/google/uuid"
)

var (
	ErrGatewayNotConfigured    = errors.New("payment gateway is not configured: MIDTRANS_SERVER_KEY is missing")
	ErrInvalidSnapRequest      = errors.New("invalid midtrans snap request")
	ErrPaymentNotPayable       = errors.New("payment bill cannot be paid: only unpaid or overdue bills can generate a snap token")
	ErrInvalidWebhookSignature = errors.New("invalid midtrans webhook signature")
)

type MidtransWebhookNotification = model.MidtransWebhookNotification

// TenantPaymentFinder defines the minimal outbound repository port required to load a tenant-owned payment bill.
type TenantPaymentFinder interface {
	FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*Payment, error)
}

// MidtransWebhookRepository defines the outbound persistence port for processing Midtrans webhook notifications atomically.
type MidtransWebhookRepository interface {
	ProcessMidtransWebhook(ctx context.Context, notif MidtransWebhookNotification, mappedStatus string, grossAmountMinor int64) (*Payment, bool, error)
}

// Gateway defines the outbound hexagonal port for external payment gateway providers (e.g. Midtrans Snap).
type Gateway interface {
	IsConfigured() bool
	ClientKey() string
	IsProduction() bool
	CreateSnapTransaction(ctx context.Context, req SnapRequest) (*SnapResponse, error)
	VerifySignatureKey(orderID, statusCode, grossAmount, signatureKey string) bool
}

// CoreTransactionGateway defines the outbound hexagonal port for querying and cancelling Midtrans Core API transactions.
type CoreTransactionGateway interface {
	CancelTransaction(ctx context.Context, orderID string) error
	GetTransactionStatus(ctx context.Context, orderID string) (*MidtransWebhookNotification, error)
}

type SnapTokenResult struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
	OrderID     string `json:"order_id"`
	ClientKey   string `json:"client_key,omitempty"`
}

type SnapTransactionDetails struct {
	OrderID     string `json:"order_id"`
	GrossAmount int64  `json:"gross_amount"`
}

type SnapCustomerDetails struct {
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
}

type SnapItemDetail struct {
	ID       string `json:"id"`
	Price    int64  `json:"price"`
	Quantity int    `json:"quantity"`
	Name     string `json:"name"`
}

type SnapCallbacks struct {
	Finish string `json:"finish,omitempty"`
}

type SnapRequest struct {
	TransactionDetails SnapTransactionDetails `json:"transaction_details"`
	CustomerDetails    *SnapCustomerDetails   `json:"customer_details,omitempty"`
	ItemDetails        []SnapItemDetail       `json:"item_details,omitempty"`
	Callbacks          *SnapCallbacks         `json:"callbacks,omitempty"`
	EnabledPayments    []string               `json:"enabled_payments,omitempty"`
}

type SnapResponse struct {
	Token         string   `json:"token"`
	RedirectURL   string   `json:"redirect_url"`
	ErrorMessages []string `json:"error_messages,omitempty"`
}

