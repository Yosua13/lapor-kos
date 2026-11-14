package service

import (
	"net/http"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/midtrans"
)

const (
	DefaultMidtransSandboxSnapURL    = midtrans.DefaultSandboxSnapURL
	DefaultMidtransProductionSnapURL = midtrans.DefaultProductionSnapURL
)

var (
	ErrMidtransNotConfigured = payment.ErrGatewayNotConfigured
	ErrInvalidSnapRequest    = payment.ErrInvalidSnapRequest
)

type MidtransServiceInterface = payment.Gateway
type SnapTransactionDetails = payment.SnapTransactionDetails
type SnapCustomerDetails = payment.SnapCustomerDetails
type SnapItemDetail = payment.SnapItemDetail
type SnapCallbacks = payment.SnapCallbacks
type SnapRequest = payment.SnapRequest
type SnapResponse = payment.SnapResponse
type MidtransService = midtrans.Client

func NewMidtransService() *MidtransService {
	return midtrans.NewClientFromEnv()
}

func NewMidtransServiceWithConfig(
	serverKey, clientKey string,
	isProduction bool,
	snapURL string,
	httpClient *http.Client,
) *MidtransService {
	return midtrans.NewClient(config.MidtransConfig{
		ServerKey:    serverKey,
		ClientKey:    clientKey,
		IsProduction: isProduction,
		SnapURL:      snapURL,
	}, httpClient)
}
