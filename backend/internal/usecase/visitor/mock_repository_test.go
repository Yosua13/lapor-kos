package visitor_test

import (
	"context"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/visitor"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockVisitorRepository struct {
	mock.Mock
}

func (m *MockVisitorRepository) Create(ctx context.Context, permit *visitor.VisitorPermit) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, permit)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) GetByID(ctx context.Context, propertyID, id uuid.UUID) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, propertyID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) GetByIDForTenant(ctx context.Context, tenantID, id uuid.UUID) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) GetByPassToken(ctx context.Context, token string) (*visitor.VisitorPassVerification, error) {
	args := m.Called(ctx, token)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPassVerification), args.Error(1)
}

func (m *MockVisitorRepository) List(ctx context.Context, filter visitor.VisitorPermitFilter) ([]*visitor.VisitorPermit, int, error) {
	args := m.Called(ctx, filter)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*visitor.VisitorPermit), args.Int(1), args.Error(2)
}

func (m *MockVisitorRepository) ListForTenant(ctx context.Context, tenantID uuid.UUID, filter visitor.VisitorPermitFilter) ([]*visitor.VisitorPermit, int, error) {
	args := m.Called(ctx, tenantID, filter)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]*visitor.VisitorPermit), args.Int(1), args.Error(2)
}

func (m *MockVisitorRepository) UpdateStatus(ctx context.Context, propertyID, id, actorID uuid.UUID, toStatus visitor.VisitorPermitStatus, reason *string, changeReqs *string) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, propertyID, id, actorID, toStatus, reason, changeReqs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) CheckIn(ctx context.Context, propertyID, id, actorID uuid.UUID, notes *string) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, propertyID, id, actorID, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) CheckOut(ctx context.Context, propertyID, id, actorID uuid.UUID, notes *string) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, propertyID, id, actorID, notes)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) Cancel(ctx context.Context, id, actorID uuid.UUID, isTenant bool, reason *string) (*visitor.VisitorPermit, error) {
	args := m.Called(ctx, id, actorID, isTenant, reason)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermit), args.Error(1)
}

func (m *MockVisitorRepository) GetSummary(ctx context.Context, propertyID uuid.UUID) (*visitor.VisitorPermitSummary, error) {
	args := m.Called(ctx, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*visitor.VisitorPermitSummary), args.Error(1)
}
