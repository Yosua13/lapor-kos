package contract

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Repository interface {
	Detail(ctx context.Context, propertyID, contractID uuid.UUID) (*ContractDetail, error)
	Transition(ctx context.Context, propertyID, actorID, contractID uuid.UUID, to, reason string, effectiveDate *time.Time) error
	AcceptByTenant(ctx context.Context, actorID, contractID uuid.UUID, sourceIP, userAgent string) error
	Amend(ctx context.Context, propertyID, actorID uuid.UUID, amended *Contract, reason string) error
	Renew(ctx context.Context, propertyID, actorID, contractID uuid.UUID, child *Contract, reason string) error
	CurrentSnapshot(ctx context.Context, propertyID, contractID uuid.UUID) (*ContractVersion, *Contract, error)
	SaveDocument(ctx context.Context, propertyID, contractID, versionID, actorID uuid.UUID, version int, fileName, hash string, content []byte) (*ContractDocument, error)
	DocumentContent(ctx context.Context, propertyID, contractID, documentID, actorID uuid.UUID) (string, string, []byte, error)
	TenantContract(ctx context.Context, actorID, contractID uuid.UUID) (uuid.UUID, error)
}
