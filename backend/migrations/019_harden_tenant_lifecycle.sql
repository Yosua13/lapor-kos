-- EPIC 02 hardening: enforce property ownership at the database boundary,
-- persist invitation delivery/contact verification state, and keep an
-- append-only lifecycle audit trail. Existing business history is preserved.
BEGIN;

ALTER TABLE tenant_profiles
    ADD COLUMN IF NOT EXISTS verified_contact_method VARCHAR(20),
    ADD COLUMN IF NOT EXISTS contact_verified_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_profiles_verified_contact_method_check'
    ) THEN
        ALTER TABLE tenant_profiles
            ADD CONSTRAINT tenant_profiles_verified_contact_method_check
            CHECK (verified_contact_method IS NULL OR verified_contact_method IN ('email', 'whatsapp'));
    END IF;
END $$;

ALTER TABLE tenant_invitations
    ADD COLUMN IF NOT EXISTS delivery_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    ADD COLUMN IF NOT EXISTS delivery_attempted_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tenant_invitations_delivery_status_check'
    ) THEN
        ALTER TABLE tenant_invitations
            ADD CONSTRAINT tenant_invitations_delivery_status_check
            CHECK (delivery_status IN ('unknown', 'pending', 'sent', 'failed'));
    END IF;
END $$;

-- Composite keys make it impossible for a profile, invitation, consent, file,
-- or document row to reference an entity from a different property.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_profiles_id_property_unique') THEN
        ALTER TABLE tenant_profiles
            ADD CONSTRAINT tenant_profiles_id_property_unique UNIQUE (id, property_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_id_property_unique') THEN
        ALTER TABLE files
            ADD CONSTRAINT files_id_property_unique UNIQUE (id, property_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_invitations_profile_property_fk') THEN
        ALTER TABLE tenant_invitations
            ADD CONSTRAINT tenant_invitations_profile_property_fk
            FOREIGN KEY (tenant_profile_id, property_id)
            REFERENCES tenant_profiles(id, property_id)
            ON DELETE RESTRICT NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_consents_profile_property_fk') THEN
        ALTER TABLE tenant_consent_records
            ADD CONSTRAINT tenant_consents_profile_property_fk
            FOREIGN KEY (tenant_profile_id, property_id)
            REFERENCES tenant_profiles(id, property_id)
            ON DELETE RESTRICT NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_documents_profile_property_fk') THEN
        ALTER TABLE tenant_documents
            ADD CONSTRAINT tenant_documents_profile_property_fk
            FOREIGN KEY (tenant_profile_id, property_id)
            REFERENCES tenant_profiles(id, property_id)
            ON DELETE RESTRICT NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_documents_file_property_fk') THEN
        ALTER TABLE tenant_documents
            ADD CONSTRAINT tenant_documents_file_property_fk
            FOREIGN KEY (file_id, property_id)
            REFERENCES files(id, property_id)
            ON DELETE RESTRICT NOT VALID;
    END IF;
END $$;

ALTER TABLE tenant_invitations VALIDATE CONSTRAINT tenant_invitations_profile_property_fk;
ALTER TABLE tenant_consent_records VALIDATE CONSTRAINT tenant_consents_profile_property_fk;
ALTER TABLE tenant_documents VALIDATE CONSTRAINT tenant_documents_profile_property_fk;
ALTER TABLE tenant_documents VALIDATE CONSTRAINT tenant_documents_file_property_fk;

CREATE TABLE IF NOT EXISTS tenant_lifecycle_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_profile_id UUID NOT NULL,
    invitation_id UUID REFERENCES tenant_invitations(id) ON DELETE RESTRICT,
    actor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_lifecycle_audit_profile_property_fk
        FOREIGN KEY (tenant_profile_id, property_id)
        REFERENCES tenant_profiles(id, property_id)
        ON DELETE RESTRICT,
    CONSTRAINT tenant_lifecycle_audit_action_check CHECK (
        action IN (
            'invitation_created',
            'invitation_delivery_sent',
            'invitation_delivery_failed',
            'invitation_revoked',
            'invitation_accepted',
            'tenant_document_uploaded',
            'tenant_session_revoked'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_audit_property_created
    ON tenant_lifecycle_audit_logs(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_lifecycle_audit_profile_created
    ON tenant_lifecycle_audit_logs(tenant_profile_id, created_at DESC);

-- Consent, access, and lifecycle records are evidence. Corrections must be
-- appended as new records instead of mutating or deleting prior history.
CREATE OR REPLACE FUNCTION prevent_tenant_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_consent_records_append_only ON tenant_consent_records;
CREATE TRIGGER tenant_consent_records_append_only
    BEFORE UPDATE OR DELETE ON tenant_consent_records
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_history_mutation();

DROP TRIGGER IF EXISTS tenant_document_access_logs_append_only ON tenant_document_access_logs;
CREATE TRIGGER tenant_document_access_logs_append_only
    BEFORE UPDATE OR DELETE ON tenant_document_access_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_history_mutation();

DROP TRIGGER IF EXISTS tenant_lifecycle_audit_logs_append_only ON tenant_lifecycle_audit_logs;
CREATE TRIGGER tenant_lifecycle_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON tenant_lifecycle_audit_logs
    FOR EACH ROW EXECUTE FUNCTION prevent_tenant_history_mutation();

COMMIT;
