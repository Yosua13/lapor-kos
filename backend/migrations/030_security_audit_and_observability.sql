-- 030_security_audit_and_observability.sql
-- Security, financial audit trails, user session revocations, and system health event tracking.

-- 1. Financial Audit Logs (Append-only ledger for all critical financial mutations)
CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255) NOT NULL DEFAULT '',
    actor_role VARCHAR(50) NOT NULL DEFAULT '',
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    amount_minor BIGINT NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    reason TEXT NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(50) NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_prop_created ON financial_audit_logs(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_financial_audit_entity ON financial_audit_logs(property_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_correlation ON financial_audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_actor ON financial_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_financial_audit_action ON financial_audit_logs(property_id, action);

-- Trigger: protect_financial_audit_logs enforces that financial audit logs are strictly append-only
CREATE OR REPLACE FUNCTION protect_financial_audit_logs() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'financial_audit_logs is append-only; audit entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_financial_audit_logs ON financial_audit_logs;
CREATE TRIGGER trg_protect_financial_audit_logs
BEFORE UPDATE OR DELETE ON financial_audit_logs
FOR EACH ROW EXECUTE FUNCTION protect_financial_audit_logs();

-- 2. User Session Revocations (Global session invalidation across all roles)
CREATE TABLE IF NOT EXISTS user_session_revocations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revoked_after TIMESTAMPTZ NOT NULL,
    reason VARCHAR(100) NOT NULL DEFAULT 'manual_revocation',
    revoked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_session_revocations_user ON user_session_revocations(user_id);

-- 3. Security & System Health Events (Observability & Incident Audit)
CREATE TABLE IF NOT EXISTS system_health_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL, -- e.g. 'restore_drill_completed', 'backup_verified', 'security_scan', 'rate_limit_exceeded', 'unauthorized_access_attempt'
    severity VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    source VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    correlation_id VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_audit_type ON system_health_audit_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_audit_correlation ON system_health_audit_events(correlation_id);
