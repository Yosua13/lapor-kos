package visitor

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	Create(ctx context.Context, permit *VisitorPermit) (*VisitorPermit, error)
	GetByID(ctx context.Context, propertyID, id uuid.UUID) (*VisitorPermit, error)
	GetByIDForTenant(ctx context.Context, tenantID, id uuid.UUID) (*VisitorPermit, error)
	GetByPassToken(ctx context.Context, token string) (*VisitorPassVerification, error)
	List(ctx context.Context, filter VisitorPermitFilter) ([]*VisitorPermit, int, error)
	ListForTenant(ctx context.Context, tenantID uuid.UUID, filter VisitorPermitFilter) ([]*VisitorPermit, int, error)
	UpdateStatus(ctx context.Context, propertyID, id, actorID uuid.UUID, toStatus VisitorPermitStatus, reason *string, changeReqs *string) (*VisitorPermit, error)
	CheckIn(ctx context.Context, propertyID, id, actorID uuid.UUID, notes *string) (*VisitorPermit, error)
	CheckOut(ctx context.Context, propertyID, id, actorID uuid.UUID, notes *string) (*VisitorPermit, error)
	Cancel(ctx context.Context, id, actorID uuid.UUID, isTenant bool, reason *string) (*VisitorPermit, error)
	GetSummary(ctx context.Context, propertyID uuid.UUID) (*VisitorPermitSummary, error)
}
