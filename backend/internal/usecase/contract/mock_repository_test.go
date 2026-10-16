package contract_test

import (
	"context"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/contract"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockContractRepository struct {
	mock.Mock
}

func (m *MockContractRepository) Detail(ctx context.Context, propertyID, contractID uuid.UUID) (*contract.ContractDetail, error) {
	args := m.Called(ctx, propertyID, contractID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*contract.ContractDetail), args.Error(1)
}

func (m *MockContractRepository) Transition(ctx context.Context, propertyID, actorID, contractID uuid.UUID, to, reason string, effectiveDate *time.Time) error {
	args := m.Called(ctx, propertyID, actorID, contractID, to, reason, effectiveDate)
	return args.Error(0)
}

func (m *MockContractRepository) AcceptByTenant(ctx context.Context, actorID, contractID uuid.UUID, sourceIP, userAgent string) error {
	args := m.Called(ctx, actorID, contractID, sourceIP, userAgent)
	return args.Error(0)
}

func (m *MockContractRepository) Amend(ctx context.Context, propertyID, actorID uuid.UUID, amended *contract.Contract, reason string) error {
	args := m.Called(ctx, propertyID, actorID, amended, reason)
	return args.Error(0)
}

func (m *MockContractRepository) Renew(ctx context.Context, propertyID, actorID, contractID uuid.UUID, child *contract.Contract, reason string) error {
	args := m.Called(ctx, propertyID, actorID, contractID, child, reason)
	return args.Error(0)
}

func (m *MockContractRepository) CurrentSnapshot(ctx context.Context, propertyID, contractID uuid.UUID) (*contract.ContractVersion, *contract.Contract, error) {
	args := m.Called(ctx, propertyID, contractID)
	var v *contract.ContractVersion
	var c *contract.Contract
	if args.Get(0) != nil {
		v = args.Get(0).(*contract.ContractVersion)
	}
	if args.Get(1) != nil {
		c = args.Get(1).(*contract.Contract)
	}
	return v, c, args.Error(2)
}

func (m *MockContractRepository) SaveDocument(ctx context.Context, propertyID, contractID, versionID, actorID uuid.UUID, version int, fileName, hash string, content []byte) (*contract.ContractDocument, error) {
	args := m.Called(ctx, propertyID, contractID, versionID, actorID, version, fileName, hash, content)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*contract.ContractDocument), args.Error(1)
}

func (m *MockContractRepository) DocumentContent(ctx context.Context, propertyID, contractID, documentID, actorID uuid.UUID) (string, string, []byte, error) {
	args := m.Called(ctx, propertyID, contractID, documentID, actorID)
	return args.String(0), args.String(1), args.Get(2).([]byte), args.Error(3)
}

func (m *MockContractRepository) TenantContract(ctx context.Context, actorID, contractID uuid.UUID) (uuid.UUID, error) {
	args := m.Called(ctx, actorID, contractID)
	return args.Get(0).(uuid.UUID), args.Error(1)
}
