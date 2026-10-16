package complaint

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, c *Complaint) error
	FindByID(ctx context.Context, id, propertyID uuid.UUID) (*Complaint, error)
	FindByTenantAndID(ctx context.Context, id, userID uuid.UUID) (*Complaint, error)
	FindByTenant(ctx context.Context, userID uuid.UUID) ([]Complaint, error)
	FindByProperty(ctx context.Context, propertyID uuid.UUID) ([]Complaint, error)
	UpdateStatus(ctx context.Context, id, propertyID uuid.UUID, status string, actorID *uuid.UUID, actorName, actorRole string, notes *string) error
	Triage(ctx context.Context, id, propertyID uuid.UUID, priority, impact string, accessWindow *string, firstResponseDue, resolutionDue *time.Time, actorID *uuid.UUID, actorName, actorRole string, reason *string) error
	Assign(ctx context.Context, id, propertyID uuid.UUID, assignedTo *uuid.UUID, actorID *uuid.UUID, actorName, actorRole string, notes *string) error
	TenantConfirmResolution(ctx context.Context, id, userID uuid.UUID, comment *string) error
	TenantReopen(ctx context.Context, id, userID uuid.UUID, reason string) error
	GetSLADashboardStats(ctx context.Context, propertyID uuid.UUID) (*SLADashboardStats, error)
}
