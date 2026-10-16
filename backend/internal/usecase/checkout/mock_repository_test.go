package checkout_test

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/checkout"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockCheckoutRepository struct {
	mock.Mock
}

func (m *MockCheckoutRepository) CreateCheckoutNotice(ctx context.Context, propertyID, actorID uuid.UUID, req checkout.CreateCheckoutNoticeRequest) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, propertyID, actorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) GetCheckoutCase(ctx context.Context, propertyID, id uuid.UUID) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, propertyID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) GetCheckoutCaseForTenant(ctx context.Context, tenantID, id uuid.UUID) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) ListCheckoutCases(ctx context.Context, propertyID uuid.UUID, filter checkout.CheckoutListFilter) (*checkout.CheckoutListResponse, error) {
	args := m.Called(ctx, propertyID, filter)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutListResponse), args.Error(1)
}

func (m *MockCheckoutRepository) ListCheckoutCasesForTenant(ctx context.Context, tenantID uuid.UUID) ([]checkout.CheckoutCase, error) {
	args := m.Called(ctx, tenantID)
	return args.Get(0).([]checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) RecordInspections(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req checkout.RecordInspectionRequest) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, propertyID, checkoutID, actorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) PreviewSettlement(ctx context.Context, propertyID, checkoutID uuid.UUID) (*checkout.SettlementCalculation, error) {
	args := m.Called(ctx, propertyID, checkoutID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.SettlementCalculation), args.Error(1)
}

func (m *MockCheckoutRepository) ApproveSettlement(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, notes string) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, propertyID, checkoutID, actorID, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) ExecuteCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req checkout.ExecuteCheckoutRequest) (*checkout.CheckoutCase, error) {
	args := m.Called(ctx, propertyID, checkoutID, actorID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*checkout.CheckoutCase), args.Error(1)
}

func (m *MockCheckoutRepository) CancelCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, reason string) error {
	args := m.Called(ctx, propertyID, checkoutID, actorID, reason)
	return args.Error(0)
}

func (m *MockCheckoutRepository) OverrideRoomStatus(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, targetStatus, reason string) error {
	args := m.Called(ctx, propertyID, checkoutID, actorID, targetStatus, reason)
	return args.Error(0)
}
