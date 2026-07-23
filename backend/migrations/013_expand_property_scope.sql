-- 013_expand_property_scope.sql
-- Expand-only phase for the multi-property boundary. This migration is safe to
-- deploy before application cutover: operational property_id columns remain
-- nullable until migration 015 validates the backfill.

BEGIN;

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL DEFAULT '',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    whatsapp_group_link VARCHAR(255),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT properties_status_check CHECK (status IN ('draft', 'active', 'archived')),
    CONSTRAINT properties_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS property_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    role VARCHAR(30) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT property_memberships_role_check
        CHECK (role IN ('property_owner', 'manager', 'finance', 'maintenance', 'viewer')),
    CONSTRAINT property_memberships_status_check
        CHECK (status IN ('active', 'suspended', 'revoked')),
    CONSTRAINT property_memberships_permissions_check
        CHECK (jsonb_typeof(permissions) = 'array'),
    CONSTRAINT property_memberships_user_unique UNIQUE (property_id, user_id)
);

-- The mapping table makes default-property creation repeatable and auditable.
-- Its property FK is intentionally added in 015 because the UUID mapping is
-- generated before the corresponding property row during backfill.
CREATE TABLE IF NOT EXISTS property_migration_owner_map (
    owner_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ambiguous legacy records must be explicitly resolved. No migration is
-- allowed to guess ownership for an empty room or conflicting relation.
CREATE TABLE IF NOT EXISTS property_migration_exceptions (
    id BIGSERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::JSONB,
    resolved_property_id UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT property_migration_exception_unique UNIQUE (entity_type, entity_id, reason)
);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS property_id UUID;
ALTER TABLE house_rules ADD COLUMN IF NOT EXISTS property_id UUID;

-- Private object metadata. Domain tables should ultimately reference files.id,
-- never persist a permanent public URL.
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    object_key TEXT NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    checksum_sha256 CHAR(64) NOT NULL,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    retention_until TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT files_size_check CHECK (size_bytes >= 0),
    CONSTRAINT files_visibility_check CHECK (visibility IN ('private', 'property', 'tenant')),
    CONSTRAINT files_checksum_check CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_property_memberships_user_status
    ON property_memberships(user_id, status, property_id);
CREATE INDEX IF NOT EXISTS idx_property_memberships_property_status_role
    ON property_memberships(property_id, status, role);
CREATE INDEX IF NOT EXISTS idx_properties_status_name
    ON properties(status, name);

CREATE INDEX IF NOT EXISTS idx_rooms_property_status_floor
    ON rooms(property_id, status, floor);
CREATE INDEX IF NOT EXISTS idx_contracts_property_status_end_date
    ON contracts(property_id, status, end_date);
CREATE INDEX IF NOT EXISTS idx_payments_property_status_due_date
    ON payments(property_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_complaints_property_status_created_at
    ON complaints(property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_house_rules_property_created_at
    ON house_rules(property_id, created_at);
CREATE INDEX IF NOT EXISTS idx_files_property_created_at
    ON files(property_id, created_at DESC) WHERE deleted_at IS NULL;

-- These composite candidate keys support same-property foreign keys in 015.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_id_property
    ON rooms(id, property_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_contracts_id_property
    ON contracts(id, property_id);

COMMIT;
