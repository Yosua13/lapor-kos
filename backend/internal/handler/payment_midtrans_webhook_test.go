package handler

import (
	"bytes"
	"context"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/config"
	"github.com/Yosua13/lapor-kos/backend/internal/infrastructure/midtrans"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type midtransWebhookRepoSpy struct {
	paymentRepoSpy
	gotNotif        model.MidtransWebhookNotification
	gotMappedStatus string
	gotGrossMinor   int64
	isDuplicate     bool
	callCount       int
}

func (s *midtransWebhookRepoSpy) ProcessMidtransWebhook(
	_ context.Context,
	notif model.MidtransWebhookNotification,
	mappedStatus string,
	grossAmountMinor int64,
) (*model.Payment, bool, error) {
	s.callCount++
	s.gotNotif = notif
	s.gotMappedStatus = mappedStatus
	s.gotGrossMinor = grossAmountMinor

	ref := notif.TransactionID
	return &model.Payment{
		ID:              uuid.MustParse("12345678-1234-1234-1234-1234567890ab"),
		Status:          mappedStatus,
		Provider:        "midtrans",
		ProviderRef:     &ref,
		PaidAmountMinor: grossAmountMinor,
	}, s.isDuplicate, nil
}

func computeTestMidtransSignature(orderID, statusCode, grossAmount, serverKey string) string {
	sum := sha512.Sum512([]byte(orderID + statusCode + grossAmount + serverKey))
	return hex.EncodeToString(sum[:])
}

func TestMidtransWebhook_ValidSignatureSettlementReturns200AndIdempotentRetry(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serverKey := "SB-Mid-server-test-key-999"
	gw := midtrans.NewClient(config.MidtransConfig{
		ServerKey: serverKey,
		ClientKey: "SB-Mid-client-test-key",
	}, nil)

	spy := &midtransWebhookRepoSpy{}
	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)

	r := gin.New()
	r.POST("/api/payments/webhook/midtrans", h.ProcessMidtransWebhook)

	orderID := "LK-12345678-1794666600"
	statusCode := "200"
	grossAmount := "1350000.00"
	sig := computeTestMidtransSignature(orderID, statusCode, grossAmount, serverKey)

	payload := model.MidtransWebhookNotification{
		TransactionTime:   "2026-11-14 22:00:00",
		TransactionStatus: "settlement",
		TransactionID:     "513f1f01-c9da-474c-9fc9-d5c64364b709",
		StatusMessage:     "midtrans payment notification",
		StatusCode:        statusCode,
		SignatureKey:      sig,
		PaymentType:       "qris",
		OrderID:           orderID,
		GrossAmount:       grossAmount,
		FraudStatus:       "accept",
		Currency:          "IDR",
	}
	bodyBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	// 1. First webhook call -> 200 OK, status = "processed", is_duplicate = false
	req1 := httptest.NewRequest(http.MethodPost, "/api/payments/webhook/midtrans", bytes.NewReader(bodyBytes))
	req1.Header.Set("Content-Type", "application/json")
	res1 := httptest.NewRecorder()
	r.ServeHTTP(res1, req1)

	require.Equal(t, http.StatusOK, res1.Code)
	var resp1 map[string]interface{}
	require.NoError(t, json.Unmarshal(res1.Body.Bytes(), &resp1))
	require.Equal(t, "processed", resp1["status"])
	require.Equal(t, false, resp1["is_duplicate"])
	require.Equal(t, "paid", resp1["payment_status"])
	require.Equal(t, int64(1350000), spy.gotGrossMinor)

	// 2. Duplicate webhook retry -> 200 OK, status = "already_processed", is_duplicate = true
	spy.isDuplicate = true
	req2 := httptest.NewRequest(http.MethodPost, "/api/payments/webhook/midtrans", bytes.NewReader(bodyBytes))
	req2.Header.Set("Content-Type", "application/json")
	res2 := httptest.NewRecorder()
	r.ServeHTTP(res2, req2)

	require.Equal(t, http.StatusOK, res2.Code)
	var resp2 map[string]interface{}
	require.NoError(t, json.Unmarshal(res2.Body.Bytes(), &resp2))
	require.Equal(t, "already_processed", resp2["status"])
	require.Equal(t, true, resp2["is_duplicate"])
}

func TestMidtransWebhook_InvalidSignatureReturns401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	serverKey := "SB-Mid-server-test-key-999"
	gw := midtrans.NewClient(config.MidtransConfig{
		ServerKey: serverKey,
	}, nil)

	spy := &midtransWebhookRepoSpy{}
	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)

	r := gin.New()
	r.POST("/api/payments/webhook/midtrans", h.ProcessMidtransWebhook)

	payload := model.MidtransWebhookNotification{
		TransactionStatus: "settlement",
		TransactionID:     "513f1f01-c9da-474c-9fc9-d5c64364b709",
		StatusCode:        "200",
		SignatureKey:      "invalid-forged-signature",
		PaymentType:       "qris",
		OrderID:           "LK-12345678-1794666600",
		GrossAmount:       "1350000.00",
	}
	bodyBytes, err := json.Marshal(payload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/payments/webhook/midtrans", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusUnauthorized, res.Code)
	require.Equal(t, 0, spy.callCount)
}

