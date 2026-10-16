package payment_test

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/payment"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockPaymentRepository struct {
	mock.Mock
}

func (m *MockPaymentRepository) Create(ctx context.Context, p *payment.Payment) error {
	args := m.Called(ctx, p)
	return args.Error(0)
}

func (m *MockPaymentRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*payment.Payment, error) {
	args := m.Called(ctx, id, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) FindByIDForUser(ctx context.Context, id, userID uuid.UUID) (*payment.Payment, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) FindAll(ctx context.Context, propertyID uuid.UUID, filterStatus string, filterMonth int, filterYear int, contractIDStr string, userIDStr string) ([]payment.Payment, error) {
	args := m.Called(ctx, propertyID, filterStatus, filterMonth, filterYear, contractIDStr, userIDStr)
	return args.Get(0).([]payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) FindByUserID(ctx context.Context, userID uuid.UUID) ([]payment.Payment, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) Update(ctx context.Context, propertyID uuid.UUID, p *payment.Payment) (*payment.Payment, error) {
	args := m.Called(ctx, propertyID, p)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) SubmitProof(ctx context.Context, id, userID uuid.UUID, proofURL string, method string, totalPaid float64, notes string) error {
	args := m.Called(ctx, id, userID, proofURL, method, totalPaid, notes)
	return args.Error(0)
}

func (m *MockPaymentRepository) VerifyPaymentTx(ctx context.Context, propertyID, actorID, paymentID uuid.UUID, req payment.VerifyPaymentRequest) (*payment.Payment, error) {
	args := m.Called(ctx, propertyID, actorID, paymentID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.Payment), args.Error(1)
}

func (m *MockPaymentRepository) GetReceipt(ctx context.Context, propertyID, paymentID uuid.UUID) (*payment.PaymentReceipt, error) {
	args := m.Called(ctx, propertyID, paymentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.PaymentReceipt), args.Error(1)
}

func (m *MockPaymentRepository) GetReceiptForUser(ctx context.Context, userID, paymentID uuid.UUID) (*payment.PaymentReceipt, error) {
	args := m.Called(ctx, userID, paymentID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.PaymentReceipt), args.Error(1)
}

func (m *MockPaymentRepository) GetReconciliationReport(ctx context.Context, propertyID uuid.UUID, startDate, endDate string) (*payment.ReconciliationReport, error) {
	args := m.Called(ctx, propertyID, startDate, endDate)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.ReconciliationReport), args.Error(1)
}

func (m *MockPaymentRepository) CreateRefund(ctx context.Context, propertyID, actorID uuid.UUID, req payment.CreateRefundRequestPayload) (*payment.RefundRequest, error) {
	args := m.Called(ctx, propertyID, actorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.RefundRequest), args.Error(1)
}

func (m *MockPaymentRepository) ProcessRefund(ctx context.Context, propertyID, actorID, refundID uuid.UUID, req payment.ProcessRefundPayload) (*payment.RefundRequest, error) {
	args := m.Called(ctx, propertyID, actorID, refundID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*payment.RefundRequest), args.Error(1)
}
