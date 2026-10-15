package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/Yosua13/lapor-kos/backend/internal/payment"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/require"
)

type advancedPaymentRepoMock struct {
	paymentRepoSpy

	webhookCalledCount int
	verifyCalledCount  int
	refundCalledCount  int

	duplicateWebhook bool
	mockReceipt      *model.PaymentReceipt
	mockReconcile    *model.ReconciliationReport
}

func (m *advancedPaymentRepoMock) VerifyPaymentTx(_ context.Context, propertyID, actorID, paymentID uuid.UUID, req model.VerifyPaymentRequest) (*model.Payment, error) {
	m.verifyCalledCount++
	m.gotPropertyID = propertyID
	m.gotActorID = actorID

	return &model.Payment{
		ID:              paymentID,
		PropertyID:      propertyID,
		Status:          req.Status,
		PaidAmountMinor: req.PaidAmountMinor,
		Notes:           req.Notes,
	}, nil
}

func (m *advancedPaymentRepoMock) ProcessWebhook(_ context.Context, payload model.PaymentWebhookPayload) (*model.Payment, bool, error) {
	m.webhookCalledCount++
	m.gotPropertyID = payload.PropertyID

	p := &model.Payment{
		ID:              uuid.New(),
		PropertyID:      payload.PropertyID,
		Provider:        payload.Provider,
		ProviderRef:     &payload.ProviderRef,
		Status:          "paid",
		PaidAmountMinor: payload.AmountMinor,
	}

	if m.duplicateWebhook {
		return p, true, nil
	}
	return p, false, nil
}

func (m *advancedPaymentRepoMock) GetReceipt(_ context.Context, propertyID, paymentID uuid.UUID) (*model.PaymentReceipt, error) {
	if m.mockReceipt != nil {
		return m.mockReceipt, nil
	}
	return nil, pgx.ErrNoRows
}

func (m *advancedPaymentRepoMock) GetReceiptForUser(_ context.Context, userID, paymentID uuid.UUID) (*model.PaymentReceipt, error) {
	if m.mockReceipt != nil {
		return m.mockReceipt, nil
	}
	return nil, pgx.ErrNoRows
}

func (m *advancedPaymentRepoMock) GetReconciliationReport(_ context.Context, propertyID uuid.UUID, _, _ string) (*model.ReconciliationReport, error) {
	if m.mockReconcile != nil {
		return m.mockReconcile, nil
	}
	return &model.ReconciliationReport{
		PropertyID: propertyID,
		IsBalanced: true,
	}, nil
}

func (m *advancedPaymentRepoMock) CreateRefund(_ context.Context, propertyID, actorID uuid.UUID, req model.CreateRefundRequestPayload) (*model.RefundRequest, error) {
	m.refundCalledCount++
	return &model.RefundRequest{
		ID:          uuid.New(),
		PropertyID:  propertyID,
		PaymentID:   req.PaymentID,
		AmountMinor: req.AmountMinor,
		Status:      "requested",
		Reason:      req.Reason,
	}, nil
}

func (m *advancedPaymentRepoMock) ProcessRefund(_ context.Context, propertyID, actorID, refundID uuid.UUID, req model.ProcessRefundPayload) (*model.RefundRequest, error) {
	return &model.RefundRequest{
		ID:              refundID,
		PropertyID:      propertyID,
		Status:          req.Status,
		DisbursementRef: req.DisbursementRef,
	}, nil
}

func TestWebhookIdempotency(t *testing.T) {
	gin.SetMode(gin.TestMode)
	mock := &advancedPaymentRepoMock{duplicateWebhook: false}
	h := NewPaymentHandler(mock, nil)

	r := gin.New()
	r.POST("/api/payments/webhook", h.ProcessWebhook)

	propID := uuid.New()
	payload := model.PaymentWebhookPayload{
		Provider:      "xendit",
		ProviderRef:   "trx-unique-999",
		AmountMinor:   1500000,
		PropertyID:    propID,
		Status:        "PAID",
		PaymentMethod: "qris",
	}

	body, _ := json.Marshal(payload)

	// First execution -> should create transaction (is_duplicate: false)
	req1 := httptest.NewRequest(http.MethodPost, "/api/payments/webhook", bytes.NewReader(body))
	req1.Header.Set("Content-Type", "application/json")
	res1 := httptest.NewRecorder()
	r.ServeHTTP(res1, req1)

	require.Equal(t, http.StatusCreated, res1.Code)
	var resp1 map[string]interface{}
	err := json.Unmarshal(res1.Body.Bytes(), &resp1)
	require.NoError(t, err)
	require.Equal(t, false, resp1["is_duplicate"])
	require.Equal(t, "processed", resp1["status"])

	// Second execution (retry with same provider_ref) -> must return already_processed (is_duplicate: true)
	mock.duplicateWebhook = true
	req2 := httptest.NewRequest(http.MethodPost, "/api/payments/webhook", bytes.NewReader(body))
	req2.Header.Set("Content-Type", "application/json")
	res2 := httptest.NewRecorder()
	r.ServeHTTP(res2, req2)

	require.Equal(t, http.StatusOK, res2.Code)
	var resp2 map[string]interface{}
	err = json.Unmarshal(res2.Body.Bytes(), &resp2)
	require.NoError(t, err)
	require.Equal(t, true, resp2["is_duplicate"])
	require.Equal(t, "already_processed", resp2["status"])
}

func TestVerifyPaymentTxDelegation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	actorID := uuid.New()
	propertyID := uuid.New()
	paymentID := uuid.New()

	mock := &advancedPaymentRepoMock{}
	h := NewPaymentHandler(mock, nil)

	r := scopedPaymentRouter(actorID, &mock.paymentRepoSpy, http.MethodPut, "/payments/:id/verify", h.VerifyPayment)

	verifyBody := model.VerifyPaymentRequest{
		Status:          "paid",
		PaidAmountMinor: 1500000,
		Notes:           "Transfer verified via m-banking",
	}
	bodyBytes, _ := json.Marshal(verifyBody)

	req := httptest.NewRequest(http.MethodPut, "/payments/"+paymentID.String()+"/verify", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Property-ID", propertyID.String())
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)
	require.Equal(t, 1, mock.verifyCalledCount)
	require.Equal(t, propertyID, mock.gotPropertyID)
}

func TestReceiptChecksumDetection(t *testing.T) {
	now := time.Now().UTC()
	paymentID := uuid.New()
	receiptNum := payment.GenerateReceiptNumber(now, paymentID)

	snapshot := map[string]interface{}{
		"receipt_number": receiptNum,
		"payment_id":     paymentID.String(),
		"total_minor":    int64(2000000),
		"status":         "paid",
	}

	checksum, err := payment.ComputeChecksum(snapshot)
	require.NoError(t, err)

	// Untampered snapshot passes verification
	require.True(t, payment.VerifyChecksum(snapshot, checksum))

	// Corrupted snapshot fails verification
	tamperedSnapshot := map[string]interface{}{
		"receipt_number": receiptNum,
		"payment_id":     paymentID.String(),
		"total_minor":    int64(1000000), // silently modified!
		"status":         "paid",
	}
	require.False(t, payment.VerifyChecksum(tamperedSnapshot, checksum))
}

func TestReconciliationEndpointPropertyScoped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	actorID := uuid.New()
	propertyID := uuid.New()

	mock := &advancedPaymentRepoMock{
		mockReconcile: &model.ReconciliationReport{
			PropertyID:                 propertyID,
			PeriodStart:                "2026-10-01",
			PeriodEnd:                  "2026-10-31",
			TotalPaymentsReceivedMinor: 10000000,
			TotalAllocatedMinor:        9000000,
			TotalUnallocatedMinor:      500000,
			TotalCreditsCreatedMinor:   500000,
			TotalRefundedMinor:         0,
			TotalSettlementMinor:       10000000,
			IsBalanced:                 true,
		},
	}
	h := NewPaymentHandler(mock, nil)

	r := scopedPaymentRouter(actorID, &mock.paymentRepoSpy, http.MethodGet, "/payments/reconciliation", h.GetReconciliationReport)

	req := httptest.NewRequest(http.MethodGet, "/payments/reconciliation?start_date=2026-10-01&end_date=2026-10-31", nil)
	req.Header.Set("X-Property-ID", propertyID.String())
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)
	var report model.ReconciliationReport
	err := json.Unmarshal(res.Body.Bytes(), &report)
	require.NoError(t, err)
	require.Equal(t, propertyID, report.PropertyID)
	require.Equal(t, int64(10000000), report.TotalPaymentsReceivedMinor)
	require.True(t, report.IsBalanced)
}
