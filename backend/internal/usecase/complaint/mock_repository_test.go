package complaint_test

import (
	"context"
	"time"

	"github.com/Yosua13/lapor-kos/backend/internal/domain/complaint"
	"github.com/google/uuid"
	"github.com/stretchr/testify/mock"
)

type MockComplaintRepository struct {
	mock.Mock
}

func (m *MockComplaintRepository) Create(ctx context.Context, c *complaint.Complaint) error {
	args := m.Called(ctx, c)
	return args.Error(0)
}

func (m *MockComplaintRepository) FindByID(ctx context.Context, id, propertyID uuid.UUID) (*complaint.Complaint, error) {
	args := m.Called(ctx, id, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*complaint.Complaint), args.Error(1)
}

func (m *MockComplaintRepository) FindByTenantAndID(ctx context.Context, id, userID uuid.UUID) (*complaint.Complaint, error) {
	args := m.Called(ctx, id, userID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*complaint.Complaint), args.Error(1)
}

func (m *MockComplaintRepository) FindByTenant(ctx context.Context, userID uuid.UUID) ([]complaint.Complaint, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]complaint.Complaint), args.Error(1)
}

func (m *MockComplaintRepository) FindByProperty(ctx context.Context, propertyID uuid.UUID) ([]complaint.Complaint, error) {
	args := m.Called(ctx, propertyID)
	return args.Get(0).([]complaint.Complaint), args.Error(1)
}

func (m *MockComplaintRepository) UpdateStatus(ctx context.Context, id, propertyID uuid.UUID, status string, actorID *uuid.UUID, actorName, actorRole string, notes *string) error {
	args := m.Called(ctx, id, propertyID, status, actorID, actorName, actorRole, notes)
	return args.Error(0)
}

func (m *MockComplaintRepository) Triage(ctx context.Context, id, propertyID uuid.UUID, priority, impact string, accessWindow *string, firstResponseDue, resolutionDue *time.Time, actorID *uuid.UUID, actorName, actorRole string, reason *string) error {
	args := m.Called(ctx, id, propertyID, priority, impact, accessWindow, firstResponseDue, resolutionDue, actorID, actorName, actorRole, reason)
	return args.Error(0)
}

func (m *MockComplaintRepository) Assign(ctx context.Context, id, propertyID uuid.UUID, assignedTo *uuid.UUID, actorID *uuid.UUID, actorName, actorRole string, notes *string) error {
	args := m.Called(ctx, id, propertyID, assignedTo, actorID, actorName, actorRole, notes)
	return args.Error(0)
}

func (m *MockComplaintRepository) TenantConfirmResolution(ctx context.Context, id, userID uuid.UUID, comment *string) error {
	args := m.Called(ctx, id, userID, comment)
	return args.Error(0)
}

func (m *MockComplaintRepository) TenantReopen(ctx context.Context, id, userID uuid.UUID, reason string) error {
	args := m.Called(ctx, id, userID, reason)
	return args.Error(0)
}

func (m *MockComplaintRepository) GetSLADashboardStats(ctx context.Context, propertyID uuid.UUID) (*complaint.SLADashboardStats, error) {
	args := m.Called(ctx, propertyID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*complaint.SLADashboardStats), args.Error(1)
}
