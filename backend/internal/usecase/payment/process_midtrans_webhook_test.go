package payment_test

import (
	"context"
	"crypto/sha512"
	"encoding/hex"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/midtrans"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type mockMidtransWebhookRepo struct {
	gotNotif        payment.MidtransWebhookNotification
	gotMappedStatus string
	gotGrossMinor   int64
	returnPayment   *payment.Payment
	returnDuplicate bool
	returnErr       error
	callCount       int
}

func (m *mockMidtransWebhookRepo) ProcessMidtransWebhook(
	_ context.Context,
	notif payment.MidtransWebhookNotification,
	mappedStatus string,
	grossAmountMinor int64,
) (*payment.Payment, bool, error) {
	m.callCount++
	m.gotNotif = notif
	m.gotMappedStatus = mappedStatus
	m.gotGrossMinor = grossAmountMinor
	return m.returnPayment, m.returnDuplicate, m.returnErr
}

func signMidtransTest(orderID, statusCode, grossAmount, serverKey string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	return hex.EncodeToString(sum[:])
}

func TestProcessMidtransWebhookUseCase_SettlementPaid(t *testing.T) {
	serverKey := "SB-Mid-server-secret123"
	gw := midtrans.NewClient(config.MidtransConfig{
		ServerKey: serverKey,
		ClientKey: "SB-Mid-client-123",
	}, nil)

	paymentID := uuid.MustParse("12345678-1234-1234-1234-1234567890ab")
	repo := &mockMidtransWebhookRepo{
		returnPayment: &payment.Payment{
			ID:              paymentID,
			Status:          payment.StatusPaid,
			Provider:        "midtrans",
			PaidAmountMinor: 1500000,
		},
		returnDuplicate: false,
	}

	orderID := "LK-12345678-1794666600"
	statusCode := "200"
	grossAmount := "1500000.00"
	sig := signMidtransTest(orderID, statusCode, grossAmount, serverKey)

	uc := usecase.NewProcessMidtransWebhookUseCase(repo, gw)
	res, err := uc.Execute(context.Background(), payment.MidtransWebhookNotification{
		OrderID:           orderID,
		TransactionID:     "midtrans-tx-001",
		TransactionStatus: "settlement",
		StatusCode:        statusCode,
		GrossAmount:       grossAmount,
		PaymentType:       "qris",
		SignatureKey:      sig,
	})

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, payment.StatusPaid, res.MappedStatus)
	assert.False(t, res.IsDuplicate)
	assert.Equal(t, int64(1500000), repo.gotGrossMinor)
	assert.Equal(t, 1, repo.callCount)
}

func TestProcessMidtransWebhookUseCase_InvalidSignatureRejected(t *testing.T) {
	serverKey := "SB-Mid-server-secret123"
	gw := midtrans.NewClient(config.MidtransConfig{
		ServerKey: serverKey,
	}, nil)

	repo := &mockMidtransWebhookRepo{}
	uc := usecase.NewProcessMidtransWebhookUseCase(repo, gw)

	res, err := uc.Execute(context.Background(), payment.MidtransWebhookNotification{
		OrderID:           "LK-12345678-1794666600",
		TransactionID:     "midtrans-tx-001",
		TransactionStatus: "settlement",
		StatusCode:        "200",
		GrossAmount:       "1500000.00",
		SignatureKey:      "forged-signature-key",
	})

	require.Error(t, err)
	assert.Nil(t, res)
	assert.ErrorIs(t, err, payment.ErrInvalidWebhookSignature)
	assert.Equal(t, 0, repo.callCount)
}

func TestProcessMidtransWebhookUseCase_StatusMapping(t *testing.T) {
	serverKey := "SB-Mid-server-secret123"
	gw := midtrans.NewClient(config.MidtransConfig{ServerKey: serverKey}, nil)

	cases := []struct {
		name              string
		transactionStatus string
		fraudStatus       string
		expectedStatus    string
	}{
		{"capture accept -> paid", "capture", "accept", payment.StatusPaid},
		{"capture challenge -> pending", "capture", "challenge", payment.StatusPending},
		{"pending -> pending", "pending", "", payment.StatusPending},
		{"expire -> unpaid", "expire", "", payment.StatusUnpaid},
		{"cancel -> unpaid", "cancel", "", payment.StatusUnpaid},
		{"deny -> rejected", "deny", "", payment.StatusRejected},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &mockMidtransWebhookRepo{
				returnPayment: &payment.Payment{Status: tc.expectedStatus},
			}
			uc := usecase.NewProcessMidtransWebhookUseCase(repo, gw)

			orderID := "LK-12345678-1794666600"
			statusCode := "200"
			grossAmount := "1200000.00"
			sig := signMidtransTest(orderID, statusCode, grossAmount, serverKey)

			res, err := uc.Execute(context.Background(), payment.MidtransWebhookNotification{
				OrderID:           orderID,
				TransactionStatus: tc.transactionStatus,
				FraudStatus:       tc.fraudStatus,
				StatusCode:        statusCode,
				GrossAmount:       grossAmount,
				SignatureKey:      sig,
			})

			require.NoError(t, err)
			assert.Equal(t, tc.expectedStatus, res.MappedStatus)
			assert.Equal(t, tc.expectedStatus, repo.gotMappedStatus)
		})
	}
}

