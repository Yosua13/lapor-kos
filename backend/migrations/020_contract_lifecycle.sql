-- EPIC 03: auditable contract lifecycle, immutable versions/documents, and
-- non-overlapping occupancy periods. This migration is safe after 019 and
-- preserves existing contracts by snapshotting their current state.
BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS current_version_id UUID,
    ADD COLUMN IF NOT EXISTS renewed_from_contract_id UUID,
    ADD COLUMN IF NOT EXISTS lifecycle_reason TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS terminated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE contracts SET status = 'ended' WHERE status IN ('expired', 'inactive');
UPDATE contracts SET status = 'draft'
WHERE status NOT IN ('draft','pending_tenant','scheduled','active','ended','terminated','renewed','cancelled');

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_status_check CHECK (
    status IN ('draft','pending_tenant','scheduled','active','ended','terminated','renewed','cancelled')
);
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_date_order_check;
ALTER TABLE contracts ADD CONSTRAINT contracts_date_order_check CHECK (end_date >= start_date);
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_renewed_from_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_renewed_from_fkey
    FOREIGN KEY (renewed_from_contract_id) REFERENCES contracts(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_renewal_child
    ON contracts(renewed_from_contract_id) WHERE renewed_from_contract_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_property_id
    ON contracts(property_id, id);

CREATE TABLE IF NOT EXISTS contract_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    snapshot JSONB NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_versions_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_versions_unique UNIQUE (contract_id, version_number),
    CONSTRAINT contract_versions_property_id_unique UNIQUE (property_id, id)
);

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_current_version_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_current_version_fkey
    FOREIGN KEY (property_id, current_version_id)
    REFERENCES contract_versions(property_id, id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    version_id UUID,
    event_type VARCHAR(40) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30),
    reason TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_events_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_events_version_property_fkey
        FOREIGN KEY (property_id, version_id) REFERENCES contract_versions(property_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS contract_policy_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    version_id UUID NOT NULL,
    accepted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_ip INET,
    user_agent TEXT NOT NULL DEFAULT '',
    CONSTRAINT contract_acceptances_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_acceptances_version_property_fkey
        FOREIGN KEY (property_id, version_id) REFERENCES contract_versions(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_acceptances_version_unique UNIQUE (contract_id, version_id, accepted_by)
);

CREATE TABLE IF NOT EXISTS occupancy_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT occupancy_periods_date_order_check CHECK (end_date >= start_date),
    CONSTRAINT occupancy_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT occupancy_room_property_fkey
        FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT,
    CONSTRAINT occupancy_room_no_overlap EXCLUDE USING gist (
        property_id WITH =,
        room_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_occupancy_open_contract
    ON occupancy_periods(contract_id) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS contract_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    version_id UUID NOT NULL,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    file_name TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    content BYTEA NOT NULL,
    sha256 CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contract_documents_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_documents_version_property_fkey
        FOREIGN KEY (property_id, version_id) REFERENCES contract_versions(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT contract_documents_version_unique UNIQUE (contract_id, version_id),
    CONSTRAINT contract_documents_hash_unique UNIQUE (property_id, sha256)
);

CREATE OR REPLACE FUNCTION reject_contract_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; append a new version or event instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_contract_status_transition() RETURNS trigger AS $$
BEGIN
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    IF NOT (
        (OLD.status = 'draft' AND NEW.status IN ('pending_tenant','cancelled')) OR
        (OLD.status = 'pending_tenant' AND NEW.status IN ('scheduled','cancelled')) OR
        (OLD.status = 'scheduled' AND NEW.status IN ('pending_tenant','active','cancelled')) OR
        (OLD.status = 'active' AND NEW.status IN ('ended','terminated','renewed'))
    ) THEN
        RAISE EXCEPTION 'illegal contract status transition: % -> %', OLD.status, NEW.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contracts_status_transition_guard ON contracts;
CREATE TRIGGER contracts_status_transition_guard BEFORE UPDATE OF status ON contracts
FOR EACH ROW EXECUTE FUNCTION enforce_contract_status_transition();

DROP TRIGGER IF EXISTS contract_versions_immutable ON contract_versions;
CREATE TRIGGER contract_versions_immutable BEFORE UPDATE OR DELETE ON contract_versions
FOR EACH ROW EXECUTE FUNCTION reject_contract_history_mutation();
DROP TRIGGER IF EXISTS contract_events_immutable ON contract_events;
CREATE TRIGGER contract_events_immutable BEFORE UPDATE OR DELETE ON contract_events
FOR EACH ROW EXECUTE FUNCTION reject_contract_history_mutation();
DROP TRIGGER IF EXISTS contract_policy_acceptances_immutable ON contract_policy_acceptances;
CREATE TRIGGER contract_policy_acceptances_immutable BEFORE UPDATE OR DELETE ON contract_policy_acceptances
FOR EACH ROW EXECUTE FUNCTION reject_contract_history_mutation();
DROP TRIGGER IF EXISTS contract_documents_immutable ON contract_documents;
CREATE TRIGGER contract_documents_immutable BEFORE UPDATE OR DELETE ON contract_documents
FOR EACH ROW EXECUTE FUNCTION reject_contract_history_mutation();

INSERT INTO contract_versions (property_id, contract_id, version_number, snapshot, reason, created_by, created_at)
SELECT c.property_id, c.id, 1,
       jsonb_build_object(
           'contract_id', c.id, 'property_id', c.property_id, 'room_id', c.room_id,
           'user_id', c.user_id, 'start_date', c.start_date, 'end_date', c.end_date,
           'rental_duration', c.rental_duration, 'monthly_rent', c.monthly_rent,
           'total_price', c.total_price, 'deposit', c.deposit,
           'electricity_bill', c.electricity_bill, 'water_bill', c.water_bill,
           'other_bills', c.other_bills, 'payment_interval', c.payment_interval,
           'payment_due_day', c.payment_due_day, 'notes', COALESCE(c.notes, '')
       ),
       'Snapshot awal dari migrasi lifecycle', c.owner_id, c.created_at
FROM contracts c
WHERE NOT EXISTS (SELECT 1 FROM contract_versions v WHERE v.contract_id = c.id);

UPDATE contracts c SET current_version_id = v.id
FROM contract_versions v
WHERE v.contract_id = c.id AND v.version_number = 1 AND c.current_version_id IS NULL;

INSERT INTO contract_events (property_id, contract_id, version_id, event_type, to_status, reason, actor_id, created_at)
SELECT c.property_id, c.id, c.current_version_id, 'migrated', c.status,
       'Kontrak dimigrasikan ke lifecycle versioned', c.owner_id, c.created_at
FROM contracts c
WHERE NOT EXISTS (SELECT 1 FROM contract_events e WHERE e.contract_id = c.id);

INSERT INTO occupancy_periods (property_id, contract_id, room_id, user_id, start_date, end_date, closed_at, created_at)
SELECT c.property_id, c.id, c.room_id, c.user_id, c.start_date, c.end_date, NULL, c.created_at
FROM contracts c
WHERE c.status = 'active' AND c.room_id IS NOT NULL AND c.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM occupancy_periods o WHERE o.contract_id = c.id);

CREATE INDEX IF NOT EXISTS idx_contract_versions_contract ON contract_versions(property_id, contract_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_contract_events_contract ON contract_events(property_id, contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_occupancy_property_user ON occupancy_periods(property_id, user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON contract_documents(property_id, contract_id, published_at DESC);

COMMIT;
