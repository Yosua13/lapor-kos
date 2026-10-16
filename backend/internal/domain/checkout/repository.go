package checkout

import (
	"context"

	"github.com/google/uuid"
)

type Repository interface {
	CreateCheckoutNotice(ctx context.Context, propertyID, actorID uuid.UUID, req CreateCheckoutNoticeRequest) (*CheckoutCase, error)
	GetCheckoutCase(ctx context.Context, propertyID, id uuid.UUID) (*CheckoutCase, error)
	GetCheckoutCaseForTenant(ctx context.Context, tenantID, id uuid.UUID) (*CheckoutCase, error)
	ListCheckoutCases(ctx context.Context, propertyID uuid.UUID, filter CheckoutListFilter) (*CheckoutListResponse, error)
	ListCheckoutCasesForTenant(ctx context.Context, tenantID uuid.UUID) ([]CheckoutCase, error)
	RecordInspections(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req RecordInspectionRequest) (*CheckoutCase, error)
	PreviewSettlement(ctx context.Context, propertyID, checkoutID uuid.UUID) (*SettlementCalculation, error)
	ApproveSettlement(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, notes string) (*CheckoutCase, error)
	ExecuteCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, req ExecuteCheckoutRequest) (*CheckoutCase, error)
	CancelCheckout(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, reason string) error
	OverrideRoomStatus(ctx context.Context, propertyID, checkoutID, actorID uuid.UUID, targetStatus, reason string) error
}
