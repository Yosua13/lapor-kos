package payment

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

var (
	ErrGatewayNotConfigured = errors.New("payment gateway is not configured: MIDTRANS_SERVER_KEY is missing")
	ErrInvalidSnapRequest   = errors.New("invalid midtrans snap request")
	ErrPaymentNotPayable    = errors.New("payment bill cannot be paid: only unpaid or overdue bills can generate a snap token")
)

// TenantPaymentFinder defines the minimal outbound repository port required to load a tenant-owned payment bill.
type TenantPaymentFinder interface {
	FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*Payment, error)
}

// Gateway defines the outbound hexagonal port for external payment gateway providers (e.g. Midtrans Snap).
type Gateway interface {
	IsConfigured() bool
	ClientKey() string
	IsProduction() bool
	CreateSnapTransaction(ctx context.Context, req SnapRequest) (*SnapResponse, error)
	VerifySignatureKey(orderID, statusCode, grossAmount, signatureKey string) bool
}

type SnapTokenResult struct {
	Token       string `json:"token"`
	RedirectURL string `json:"redirect_url"`
	OrderID     string `json:"order_id"`
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

