package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// revokeTenantSessionForProperty enforces the session policy whenever an
// active tenancy ends outside the explicit checkout endpoint. JWTs are global
// to a user, therefore revocation deliberately invalidates every existing
// session for that identity after the specified event.
func revokeTenantSessionForProperty(ctx context.Context, tx pgx.Tx, propertyID, userID uuid.UUID, reason string) error {
	if userID == uuid.Nil {
		return nil
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO tenant_lifecycle_audit_logs
			(property_id,tenant_profile_id,actor_id,action,details)
		SELECT property_id,id,NULL,'tenant_session_revoked',jsonb_build_object('reason',$3::text,'user_id',$2::uuid)
		FROM tenant_profiles
		WHERE property_id=$1 AND user_id=$2 AND status='active'`, propertyID, userID, reason); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE tenant_profiles
		SET status='inactive',deactivated_at=NOW(),updated_at=NOW()
		WHERE property_id=$1 AND user_id=$2 AND status='active'`, propertyID, userID); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `
		INSERT INTO tenant_session_revocations (user_id,revoked_after,reason)
		VALUES ($1,NOW(),$2)
		ON CONFLICT (user_id) DO UPDATE
		SET revoked_after=EXCLUDED.revoked_after,reason=EXCLUDED.reason,updated_at=NOW()`, userID, reason)
	return err
}
