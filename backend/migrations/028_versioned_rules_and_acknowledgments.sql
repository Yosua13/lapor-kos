-- 028_versioned_rules_and_acknowledgments.sql
-- Epic 11: Peraturan Kos Versioned dan Acknowledgment

-- 1. Rule Sets table (Container for property rules)
CREATE TABLE IF NOT EXISTS rule_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'Peraturan Tata Tertib Kos',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_sets_property UNIQUE (property_id)
);

CREATE INDEX IF NOT EXISTS idx_rule_sets_property ON rule_sets(property_id);

-- 2. Rule Versions table (Versioned, draft -> published -> superseded)
CREATE TABLE IF NOT EXISTS rule_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_set_id UUID NOT NULL REFERENCES rule_sets(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    version_number INT NOT NULL CHECK (version_number > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'superseded', 'archived')),
    effective_from TIMESTAMPTZ,
    change_summary TEXT,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rule_version_number UNIQUE (rule_set_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_rule_versions_property_status ON rule_versions(property_id, status);
CREATE INDEX IF NOT EXISTS idx_rule_versions_rule_set ON rule_versions(rule_set_id);

-- At most one draft per rule set
CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_versions_draft 
    ON rule_versions (rule_set_id) 
    WHERE status = 'draft';

-- At most one active published version per rule set
CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_versions_published 
    ON rule_versions (rule_set_id) 
    WHERE status = 'published';

-- 3. Rule Items table (Individual rules belonging to a specific version)
CREATE TABLE IF NOT EXISTS rule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'keamanan', 'kebersihan', 'fasilitas', 'pembayaran', 'ketertiban', 'tamu', 'umum'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details TEXT[] NOT NULL DEFAULT '{}',
    severity VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (severity IN ('critical', 'major', 'standard', 'minor')),
    order_index INT NOT NULL DEFAULT 0,
    penalty_description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_items_version_order ON rule_items(rule_version_id, order_index);
CREATE INDEX IF NOT EXISTS idx_rule_items_category ON rule_items(category);

-- 4. Rule Acknowledgments table (Append-only audit trail of tenant agreement)
CREATE TABLE IF NOT EXISTS rule_acknowledgments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    rule_version_id UUID NOT NULL REFERENCES rule_versions(id) ON DELETE RESTRICT,
    tenant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_ip VARCHAR(45),
    user_agent TEXT,
    consent_text TEXT NOT NULL,
    amendment_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_ack_property_tenant ON rule_acknowledgments(property_id, tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_rule_ack_version ON rule_acknowledgments(rule_version_id);
CREATE INDEX IF NOT EXISTS idx_rule_ack_contract ON rule_acknowledgments(contract_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_ack_contract 
    ON rule_acknowledgments(property_id, rule_version_id, tenant_user_id, contract_id) 
    WHERE contract_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rule_ack_no_contract 
    ON rule_acknowledgments(property_id, rule_version_id, tenant_user_id) 
    WHERE contract_id IS NULL;

-- 5. Extend contracts table with rule_version_id and rule_acknowledged_at
ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS rule_version_id UUID REFERENCES rule_versions(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS rule_acknowledged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contracts_rule_version ON contracts(rule_version_id);

-- 6. Immutability guard functions and triggers
CREATE OR REPLACE FUNCTION reject_rule_acknowledgment_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'rule_acknowledgments table is append-only and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rule_acknowledgments_append_only ON rule_acknowledgments;
CREATE TRIGGER rule_acknowledgments_append_only
    BEFORE UPDATE OR DELETE ON rule_acknowledgments
    FOR EACH ROW EXECUTE FUNCTION reject_rule_acknowledgment_mutation();

CREATE OR REPLACE FUNCTION enforce_rule_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('published', 'superseded', 'archived') THEN
            RAISE EXCEPTION 'Cannot delete published or archived rule version %', OLD.version_number;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Allow transition from draft to published, or published to superseded/archived
        IF OLD.status IN ('published', 'superseded', 'archived') THEN
            -- Only status can change from published -> superseded or archived
            IF NEW.id <> OLD.id OR
               NEW.rule_set_id <> OLD.rule_set_id OR
               NEW.property_id <> OLD.property_id OR
               NEW.version_number <> OLD.version_number OR
               NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
               NEW.published_at IS DISTINCT FROM OLD.published_at OR
               NEW.published_by IS DISTINCT FROM OLD.published_by OR
               NEW.change_summary IS DISTINCT FROM OLD.change_summary THEN
                RAISE EXCEPTION 'Cannot modify content of published or superseded rule version %', OLD.version_number;
            END IF;
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rule_versions_immutability_guard ON rule_versions;
CREATE TRIGGER rule_versions_immutability_guard
    BEFORE UPDATE OR DELETE ON rule_versions
    FOR EACH ROW EXECUTE FUNCTION enforce_rule_version_immutability();

CREATE OR REPLACE FUNCTION enforce_rule_item_immutability()
RETURNS TRIGGER AS $$
DECLARE
    parent_status VARCHAR(20);
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO parent_status FROM rule_versions WHERE id = OLD.rule_version_id;
        IF parent_status IN ('published', 'superseded', 'archived') THEN
            RAISE EXCEPTION 'Cannot delete rule items of a published or archived version';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        SELECT status INTO parent_status FROM rule_versions WHERE id = OLD.rule_version_id;
        IF parent_status IN ('published', 'superseded', 'archived') THEN
            RAISE EXCEPTION 'Cannot update rule items of a published or archived version';
        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rule_items_immutability_guard ON rule_items;
CREATE TRIGGER rule_items_immutability_guard
    BEFORE UPDATE OR DELETE ON rule_items
    FOR EACH ROW EXECUTE FUNCTION enforce_rule_item_immutability();

-- 7. Backfill legacy house_rules into rule_sets, rule_versions (v1), and rule_items
DO $$
DECLARE
    prop RECORD;
    new_rule_set_id UUID;
    new_version_id UUID;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'house_rules') THEN
        FOR prop IN SELECT DISTINCT property_id FROM house_rules LOOP
            -- Ensure rule_set exists
            INSERT INTO rule_sets (property_id, title, description)
            VALUES (prop.property_id, 'Peraturan Tata Tertib Kos', 'Peraturan resmi tata tertib hunian kos')
            ON CONFLICT (property_id) DO UPDATE SET updated_at = NOW()
            RETURNING id INTO new_rule_set_id;

            -- If no published version exists for this property, create Version 1 from existing house_rules
            IF NOT EXISTS (SELECT 1 FROM rule_versions WHERE rule_set_id = new_rule_set_id AND status = 'published') THEN
                INSERT INTO rule_versions (
                    rule_set_id, property_id, version_number, status,
                    effective_from, change_summary, published_at
                ) VALUES (
                    new_rule_set_id, prop.property_id, 1, 'published',
                    NOW(), 'Inisialisasi versi 1 dari peraturan kos sebelumnya', NOW()
                ) RETURNING id INTO new_version_id;

                -- Migrate items
                INSERT INTO rule_items (
                    rule_version_id, category, title, description, details, severity, order_index
                )
                SELECT 
                    new_version_id, category, title, description, details, 'standard',
                    ROW_NUMBER() OVER (ORDER BY created_at ASC)
                FROM house_rules
                WHERE property_id = prop.property_id;

                -- Link active contracts to this version 1
                UPDATE contracts
                SET rule_version_id = new_version_id
                WHERE property_id = prop.property_id AND rule_version_id IS NULL;
            END IF;
        END LOOP;
    END IF;
END $$;
