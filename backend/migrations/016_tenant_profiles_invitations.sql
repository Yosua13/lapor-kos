-- EPIC 02: keep property-scoped tenant data separate from the global login
-- identity. Raw invitation secrets are never stored; only their SHA-256 hash
-- is persisted.
BEGIN;

CREATE TABLE IF NOT EXISTS tenant_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_profiles_status_check CHECK (status IN ('draft', 'invited', 'active', 'inactive'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_profiles_property_email
    ON tenant_profiles(property_id, LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_profiles_property_user
    ON tenant_profiles(property_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_user_status
    ON tenant_profiles(user_id, status) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE RESTRICT,
    token_digest CHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_property_status
    ON tenant_invitations(property_id, status, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_invitations_profile
    ON tenant_invitations(tenant_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE RESTRICT,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    policy_type VARCHAR(50) NOT NULL,
    policy_version VARCHAR(100) NOT NULL,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_ip INET,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_consent_records_unique UNIQUE (tenant_profile_id, policy_type, policy_version)
);

CREATE TABLE IF NOT EXISTS tenant_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_profile_id UUID NOT NULL REFERENCES tenant_profiles(id) ON DELETE RESTRICT,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
    document_type VARCHAR(30) NOT NULL,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tenant_documents_type_check CHECK (document_type IN ('ktp', 'selfie', 'supporting')),
    CONSTRAINT tenant_documents_file_unique UNIQUE (file_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_profile ON tenant_documents(tenant_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_document_access_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_document_id UUID NOT NULL REFERENCES tenant_documents(id) ON DELETE RESTRICT,
    accessed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(30) NOT NULL,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_session_revocations (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    revoked_after TIMESTAMPTZ NOT NULL,
    reason VARCHAR(50) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Preserve legacy active and historical tenants as profiles. The global user
-- columns remain untouched for compatibility with existing contracts.
INSERT INTO tenant_profiles (property_id, user_id, full_name, email, phone, status, activated_at)
SELECT DISTINCT ON (c.property_id, u.id)
    c.property_id,
    u.id,
    u.name,
    LOWER(u.email),
    COALESCE(u.phone, ''),
    CASE WHEN c.status = 'active' THEN 'active' ELSE 'inactive' END,
    CASE WHEN c.status = 'active' THEN COALESCE(c.created_at, NOW()) ELSE NULL END
FROM contracts c
JOIN users u ON u.id = c.user_id
WHERE c.property_id IS NOT NULL
ORDER BY c.property_id, u.id, (c.status = 'active') DESC, c.created_at DESC
ON CONFLICT DO NOTHING;

COMMIT;
