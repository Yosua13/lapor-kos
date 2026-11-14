package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	domainpayment "github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type snapGatewayStub struct {
	configured  bool
	lastRequest domainpayment.SnapRequest
	response    *domainpayment.SnapResponse
	err         error
}

func (s *snapGatewayStub) IsConfigured() bool {
	return s.configured
}

func (s *snapGatewayStub) ClientKey() string {
	return "SB-Mid-client-test"
}

func (s *snapGatewayStub) IsProduction() bool {
	return false
}

func (s *snapGatewayStub) CreateSnapTransaction(_ context.Context, req domainpayment.SnapRequest) (*domainpayment.SnapResponse, error) {
	s.lastRequest = req
	if s.err != nil {
		return nil, s.err
	}
	return s.response, nil
}

func (s *snapGatewayStub) VerifySignatureKey(_, _, _, _ string) bool {
	return true
}

func TestGenerateSnapToken_SuccessForOwnerTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tenantID := uuid.New()
	paymentID := uuid.MustParse("12345678-1234-1234-1234-1234567890ab")

	spy := &paymentRepoSpy{
		findForUser: &model.Payment{
			ID:                paymentID,
			Status:            "unpaid",
			PeriodMonth:       11,
			PeriodYear:        2026,
			AmountRent:        1200000,
			AmountElectricity: 100000,
			AmountWater:       50000,
			AmountOther:       0,
			AmountMinor:       1350000,
		},
	}
	gw := &snapGatewayStub{
		configured: true,
		response: &domainpayment.SnapResponse{
			Token:       "snap-tok-abc123",
			RedirectURL: "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-tok-abc123",
		},
	}

	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)
	r := gin.New()
	r.POST("/api/payments/:id/snap-token", func(c *gin.Context) {
		c.Set("user_id", tenantID.String())
		c.Next()
	}, h.GenerateSnapToken)

	req := httptest.NewRequest(http.MethodPost, "/api/payments/"+paymentID.String()+"/snap-token", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusOK, res.Code)
	require.Equal(t, tenantID, spy.gotActorID)

	var body map[string]string
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &body))
	require.Equal(t, "snap-tok-abc123", body["token"])
	require.Equal(t, "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-tok-abc123", body["redirect_url"])
	require.True(t, strings.HasPrefix(body["order_id"], "LK-12345678-"))
	require.Equal(t, int64(1350000), gw.lastRequest.TransactionDetails.GrossAmount)
	require.Len(t, gw.lastRequest.ItemDetails, 3)
}

func TestGenerateSnapToken_RejectsPaidBillWith400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tenantID := uuid.New()
	paymentID := uuid.New()

	spy := &paymentRepoSpy{
		findForUser: &model.Payment{
			ID:          paymentID,
			Status:      "paid",
			AmountMinor: 1200000,
		},
	}
	gw := &snapGatewayStub{configured: true}

	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)
	r := gin.New()
	r.POST("/api/payments/:id/snap-token", func(c *gin.Context) {
		c.Set("user_id", tenantID.String())
		c.Next()
	}, h.GenerateSnapToken)

	req := httptest.NewRequest(http.MethodPost, "/api/payments/"+paymentID.String()+"/snap-token", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusBadRequest, res.Code)
}

func TestGenerateSnapToken_RejectsOtherTenantBillWith404(t *testing.T) {
	gin.SetMode(gin.TestMode)
	otherTenantID := uuid.New()
	paymentID := uuid.New()

	// findForUser == nil simulates pgx.ErrNoRows when c.user_id != authenticated tenant
	spy := &paymentRepoSpy{findForUser: nil}
	gw := &snapGatewayStub{configured: true}

	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)
	r := gin.New()
	r.POST("/api/payments/:id/snap-token", func(c *gin.Context) {
		c.Set("user_id", otherTenantID.String())
		c.Next()
	}, h.GenerateSnapToken)

	req := httptest.NewRequest(http.MethodPost, "/api/payments/"+paymentID.String()+"/snap-token", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusNotFound, res.Code)
	require.Equal(t, otherTenantID, spy.gotActorID)
}

func TestGenerateSnapToken_UnauthorizedWithoutUserContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	spy := &paymentRepoSpy{}
	gw := &snapGatewayStub{configured: true}

	h := NewPaymentHandler(spy, nil).WithPaymentGateway(gw)
	r := gin.New()
	r.POST("/api/payments/:id/snap-token", h.GenerateSnapToken)

	req := httptest.NewRequest(http.MethodPost, "/api/payments/"+uuid.NewString()+"/snap-token", nil)
	res := httptest.NewRecorder()
	r.ServeHTTP(res, req)

	require.Equal(t, http.StatusUnauthorized, res.Code)
}

