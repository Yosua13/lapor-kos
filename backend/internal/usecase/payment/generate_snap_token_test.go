package payment_test

import (
	"context"
	"strings"
	"testing"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/Yosua13/lapor-kos/backend/internal/model"
	usecase "github.com/Yosua13/lapor-kos/backend/internal/usecase/payment"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

type MockPaymentGateway struct {
	mock.Mock
	configured   bool
	lastSnapReq  payment.SnapRequest
	snapResponse *payment.SnapResponse
	snapErr      error
}

func (m *MockPaymentGateway) IsConfigured() bool {
	return m.configured
}

func (m *MockPaymentGateway) ClientKey() string {
	return "SB-Mid-client-test"
}

func (m *MockPaymentGateway) IsProduction() bool {
	return false
}

func (m *MockPaymentGateway) CreateSnapTransaction(_ context.Context, req payment.SnapRequest) (*payment.SnapResponse, error) {
	m.lastSnapReq = req
	if m.snapErr != nil {
		return nil, m.snapErr
	}
	return m.snapResponse, nil
}

func (m *MockPaymentGateway) VerifySignatureKey(_, _, _, _ string) bool {
	return true
}

func TestGenerateSnapTokenUseCase_SuccessUnpaid(t *testing.T) {
	mockRepo := new(MockPaymentRepository)
	gw := &MockPaymentGateway{
		configured: true,
		snapResponse: &payment.SnapResponse{
			Token:       "snap-token-123",
			RedirectURL: "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-123",
		},
	}

	paymentID := uuid.MustParse("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
	userID := uuid.New()

	bill := &payment.Payment{
		ID:                paymentID,
		Status:            payment.StatusUnpaid,
		PeriodMonth:       11,
		PeriodYear:        2026,
		AmountRent:        1500000,
		AmountElectricity: 150000,
		AmountWater:       50000,
		AmountOther:       25000,
		AmountMinor:       1725000,
		Contract: &model.Contract{
			User: &model.User{
				ID:    userID,
				Name:  "Budi Santoso",
				Email: "budi@example.com",
				Phone: "081234567890",
			},
		},
	}

	mockRepo.On("FindByIDForUser", mock.Anything, paymentID, userID).Return(bill, nil)

	uc := usecase.NewGenerateSnapTokenUseCase(mockRepo, gw)
	res, err := uc.Execute(context.Background(), usecase.GenerateSnapTokenInput{
		PaymentID: paymentID,
		UserID:    userID,
	})

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, "snap-token-123", res.Token)
	assert.Equal(t, "https://app.sandbox.midtrans.com/snap/v4/redirection/snap-token-123", res.RedirectURL)
	assert.True(t, strings.HasPrefix(res.OrderID, "LK-a1b2c3d4-"), "order_id should match LK-{payment_id[:8]}-{ts}")

	// Verify item_details and gross_amount sent to Midtrans
	assert.Equal(t, int64(1725000), gw.lastSnapReq.TransactionDetails.GrossAmount)
	require.Len(t, gw.lastSnapReq.ItemDetails, 4)
	assert.Equal(t, "rent", gw.lastSnapReq.ItemDetails[0].ID)
	assert.Equal(t, int64(1500000), gw.lastSnapReq.ItemDetails[0].Price)
	assert.Equal(t, "electricity", gw.lastSnapReq.ItemDetails[1].ID)
	assert.Equal(t, int64(150000), gw.lastSnapReq.ItemDetails[1].Price)
	assert.Equal(t, "water", gw.lastSnapReq.ItemDetails[2].ID)
	assert.Equal(t, int64(50000), gw.lastSnapReq.ItemDetails[2].Price)
	assert.Equal(t, "other", gw.lastSnapReq.ItemDetails[3].ID)
	assert.Equal(t, int64(25000), gw.lastSnapReq.ItemDetails[3].Price)

	require.NotNil(t, gw.lastSnapReq.CustomerDetails)
	assert.Equal(t, "Budi Santoso", gw.lastSnapReq.CustomerDetails.FirstName)
	assert.Equal(t, "budi@example.com", gw.lastSnapReq.CustomerDetails.Email)
}

func TestGenerateSnapTokenUseCase_RejectsPaidBill(t *testing.T) {
	mockRepo := new(MockPaymentRepository)
	gw := &MockPaymentGateway{configured: true}

	paymentID := uuid.New()
	userID := uuid.New()

	bill := &payment.Payment{
		ID:          paymentID,
		Status:      payment.StatusPaid,
		AmountMinor: 1500000,
	}

	mockRepo.On("FindByIDForUser", mock.Anything, paymentID, userID).Return(bill, nil)

	uc := usecase.NewGenerateSnapTokenUseCase(mockRepo, gw)
	res, err := uc.Execute(context.Background(), usecase.GenerateSnapTokenInput{
		PaymentID: paymentID,
		UserID:    userID,
	})

	require.Error(t, err)
	assert.Nil(t, res)
	assert.ErrorIs(t, err, payment.ErrPaymentNotPayable)
}

func TestGenerateSnapTokenUseCase_RejectsForeignTenantBill(t *testing.T) {
	mockRepo := new(MockPaymentRepository)
	gw := &MockPaymentGateway{configured: true}

	paymentID := uuid.New()
	foreignUserID := uuid.New()

	mockRepo.On("FindByIDForUser", mock.Anything, paymentID, foreignUserID).Return(nil, pgx.ErrNoRows)

	uc := usecase.NewGenerateSnapTokenUseCase(mockRepo, gw)
	res, err := uc.Execute(context.Background(), usecase.GenerateSnapTokenInput{
		PaymentID: paymentID,
		UserID:    foreignUserID,
	})

	require.Error(t, err)
	assert.Nil(t, res)
	assert.ErrorIs(t, err, pgx.ErrNoRows)
}

func TestGenerateSnapTokenUseCase_GatewayNotConfigured(t *testing.T) {
	mockRepo := new(MockPaymentRepository)
	gw := &MockPaymentGateway{configured: false}

	uc := usecase.NewGenerateSnapTokenUseCase(mockRepo, gw)
	res, err := uc.Execute(context.Background(), usecase.GenerateSnapTokenInput{
		PaymentID: uuid.New(),
		UserID:    uuid.New(),
	})

	require.Error(t, err)
	assert.Nil(t, res)
	assert.ErrorIs(t, err, payment.ErrGatewayNotConfigured)
}

