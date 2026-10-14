-- EPIC 04: property-scoped, idempotent billing and immutable invoice history.
-- Monetary values are stored as integer minor units (IDR uses a zero-decimal
-- minor unit) so invoice totals never depend on floating point arithmetic.
BEGIN;

CREATE TABLE IF NOT EXISTS billing_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE RESTRICT,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Jakarta',
    due_day SMALLINT NOT NULL DEFAULT 1 CHECK (due_day BETWEEN 1 AND 31),
    generate_days_before SMALLINT NOT NULL DEFAULT 7 CHECK (generate_days_before BETWEEN 0 AND 60),
    generation_time TIME NOT NULL DEFAULT '00:15:00',
    invalid_day_policy VARCHAR(20) NOT NULL DEFAULT 'last_day'
        CHECK (invalid_day_policy IN ('last_day')),
    late_fee_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    late_fee_type VARCHAR(20) NOT NULL DEFAULT 'fixed'
        CHECK (late_fee_type IN ('fixed','percentage')),
    late_fee_value_minor BIGINT NOT NULL DEFAULT 0 CHECK (late_fee_value_minor >= 0),
    late_fee_grace_days SMALLINT NOT NULL DEFAULT 0 CHECK (late_fee_grace_days BETWEEN 0 AND 90),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_policies(property_id, timezone, due_day)
SELECT p.id, p.timezone,
       COALESCE((SELECT MIN(c.payment_due_day) FROM contracts c
                 WHERE c.property_id=p.id AND c.payment_due_day BETWEEN 1 AND 31), 1)
FROM properties p
ON CONFLICT(property_id) DO NOTHING;

CREATE OR REPLACE FUNCTION ensure_property_billing_policy() RETURNS trigger AS $$
BEGIN
    INSERT INTO billing_policies(property_id, timezone, due_day)
    VALUES (NEW.id, NEW.timezone, 1)
    ON CONFLICT (property_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS properties_billing_policy_default ON properties;
CREATE TRIGGER properties_billing_policy_default
AFTER INSERT ON properties
FOR EACH ROW EXECUTE FUNCTION ensure_property_billing_policy();

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    source_invoice_id UUID,
    legacy_payment_id UUID UNIQUE,
    invoice_number VARCHAR(60) NOT NULL,
    billing_period DATE NOT NULL,
    invoice_type VARCHAR(24) NOT NULL DEFAULT 'recurring'
        CHECK (invoice_type IN ('initial','recurring','final_settlement','adjustment','late_fee','legacy')),
    status VARCHAR(20) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('draft','issued','partially_paid','paid','overdue','void')),
    currency CHAR(3) NOT NULL DEFAULT 'IDR' CHECK (currency ~ '^[A-Z]{3}$'),
    due_at TIMESTAMPTZ NOT NULL,
    total_minor BIGINT NOT NULL DEFAULT 0,
    calculation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    idempotency_key TEXT NOT NULL,
    issued_at TIMESTAMPTZ,
    voided_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoices_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT invoices_source_property_fkey
        FOREIGN KEY (source_invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT invoices_number_property_unique UNIQUE (property_id, invoice_number),
    CONSTRAINT invoices_idempotency_property_unique UNIQUE (property_id, idempotency_key),
    CONSTRAINT invoices_period_unique UNIQUE (property_id, contract_id, billing_period, invoice_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_property_id ON invoices(property_id, id);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL,
    item_type VARCHAR(24) NOT NULL CHECK (item_type IN (
        'rent','electricity','water','utility_meter','one_off','discount','credit','late_fee','adjustment'
    )),
    description TEXT NOT NULL,
    quantity NUMERIC(18,6) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_amount_minor BIGINT NOT NULL,
    amount_minor BIGINT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(40),
    source_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_items_invoice_property_fkey
        FOREIGN KEY (property_id, invoice_id) REFERENCES invoices(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT invoice_items_sign_check CHECK (
        (item_type IN ('discount','credit') AND amount_minor <= 0) OR
        (item_type = 'adjustment' AND amount_minor <> 0 AND btrim(reason) <> '') OR
        (item_type NOT IN ('discount','credit','adjustment') AND amount_minor >= 0)
    )
);

CREATE TABLE IF NOT EXISTS invoice_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','void')),
    reason TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_allocations_invoice_property_fkey
        FOREIGN KEY (property_id, invoice_id) REFERENCES invoices(property_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS invoice_credit_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    status VARCHAR(12) NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','void')),
    reason TEXT NOT NULL CHECK (btrim(reason) <> ''),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_credits_invoice_property_fkey
        FOREIGN KEY (property_id, invoice_id) REFERENCES invoices(property_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS meter_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    billing_period DATE NOT NULL,
    utility_type VARCHAR(20) NOT NULL CHECK (utility_type IN ('electricity','water','other')),
    previous_value NUMERIC(18,3) NOT NULL CHECK (previous_value >= 0),
    current_value NUMERIC(18,3) NOT NULL CHECK (current_value >= previous_value),
    unit_price_minor BIGINT NOT NULL CHECK (unit_price_minor >= 0),
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    notes TEXT NOT NULL DEFAULT '',
    recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT meter_readings_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT meter_readings_period_unique UNIQUE (property_id, contract_id, billing_period, utility_type)
);

CREATE TABLE IF NOT EXISTS billing_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    billing_period DATE NOT NULL,
    trigger_type VARCHAR(16) NOT NULL CHECK (trigger_type IN ('schedule','manual','activation')),
    run_key TEXT NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('running','succeeded','partial','failed','skipped')),
    contracts_seen INTEGER NOT NULL DEFAULT 0 CHECK (contracts_seen >= 0),
    invoices_created INTEGER NOT NULL DEFAULT 0 CHECK (invoices_created >= 0),
    invoices_skipped INTEGER NOT NULL DEFAULT 0 CHECK (invoices_skipped >= 0),
    error_summary TEXT NOT NULL DEFAULT '',
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CONSTRAINT billing_job_runs_key_unique UNIQUE (property_id, run_key)
);

CREATE TABLE IF NOT EXISTS invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL,
    event_type VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT invoice_events_invoice_property_fkey
        FOREIGN KEY (property_id, invoice_id) REFERENCES invoices(property_id, id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS billing_job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    job_run_id UUID NOT NULL REFERENCES billing_job_runs(id) ON DELETE RESTRICT,
    event_type VARCHAR(32) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS billing_policy_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    event_type VARCHAR(32) NOT NULL,
    snapshot JSONB NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payments_invoice_fkey') THEN
        ALTER TABLE payments ADD CONSTRAINT payments_invoice_fkey
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT NOT VALID;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION recalculate_invoice_total() RETURNS trigger AS $$
DECLARE target UUID;
BEGIN
    target := COALESCE(NEW.invoice_id, OLD.invoice_id);
    UPDATE invoices i SET total_minor = COALESCE((
        SELECT SUM(ii.amount_minor) FROM invoice_items ii WHERE ii.invoice_id=target
    ), 0) WHERE i.id=target;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_items_recalculate_total ON invoice_items;
CREATE TRIGGER invoice_items_recalculate_total AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION recalculate_invoice_total();

CREATE OR REPLACE FUNCTION reject_invoice_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION '% is immutable; append an event, allocation, credit, or adjustment invoice', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION guard_invoice_update() RETURNS trigger AS $$
BEGIN
    IF OLD.status <> 'draft' AND (
        NEW.property_id <> OLD.property_id OR NEW.contract_id <> OLD.contract_id OR
        NEW.tenant_id <> OLD.tenant_id OR NEW.billing_period <> OLD.billing_period OR
        NEW.invoice_type <> OLD.invoice_type OR NEW.currency <> OLD.currency OR
        NEW.due_at <> OLD.due_at OR NEW.calculation_snapshot <> OLD.calculation_snapshot OR
        NEW.idempotency_key <> OLD.idempotency_key
    ) THEN RAISE EXCEPTION 'issued invoice calculation is immutable'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_update_guard ON invoices;
CREATE TRIGGER invoices_update_guard BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION guard_invoice_update();
DROP TRIGGER IF EXISTS invoice_events_immutable ON invoice_events;
CREATE TRIGGER invoice_events_immutable BEFORE UPDATE OR DELETE ON invoice_events
FOR EACH ROW EXECUTE FUNCTION reject_invoice_history_mutation();
DROP TRIGGER IF EXISTS billing_job_events_immutable ON billing_job_events;
CREATE TRIGGER billing_job_events_immutable BEFORE UPDATE OR DELETE ON billing_job_events
FOR EACH ROW EXECUTE FUNCTION reject_invoice_history_mutation();
DROP TRIGGER IF EXISTS invoice_allocations_immutable ON invoice_allocations;
CREATE TRIGGER invoice_allocations_immutable BEFORE UPDATE OR DELETE ON invoice_allocations
FOR EACH ROW EXECUTE FUNCTION reject_invoice_history_mutation();
DROP TRIGGER IF EXISTS invoice_credit_applications_immutable ON invoice_credit_applications;
CREATE TRIGGER invoice_credit_applications_immutable BEFORE UPDATE OR DELETE ON invoice_credit_applications
FOR EACH ROW EXECUTE FUNCTION reject_invoice_history_mutation();
DROP TRIGGER IF EXISTS billing_policy_events_immutable ON billing_policy_events;
CREATE TRIGGER billing_policy_events_immutable BEFORE UPDATE OR DELETE ON billing_policy_events
FOR EACH ROW EXECUTE FUNCTION reject_invoice_history_mutation();

-- Preserve existing bills as legacy invoices. Every imported value is rounded
-- once to the integer currency unit and the original columns remain untouched.
INSERT INTO invoices(property_id,contract_id,tenant_id,legacy_payment_id,invoice_number,
    billing_period,invoice_type,status,currency,due_at,calculation_snapshot,idempotency_key,
    issued_at,created_by,created_at)
SELECT p.property_id,p.contract_id,c.user_id,p.id,'LEG-'||replace(p.id::text,'-',''),
       make_date(p.period_year,p.period_month,1),'legacy',
       CASE p.status WHEN 'paid' THEN 'paid' WHEN 'partial' THEN 'partially_paid'
            WHEN 'overdue' THEN 'overdue' ELSE 'issued' END,
       pr.currency,p.due_date::timestamptz,
       jsonb_build_object('source','legacy_payment','payment_id',p.id,'original_status',p.status),
       'legacy-payment:'||p.id,p.created_at,p.owner_id,p.created_at
FROM payments p
JOIN contracts c ON c.id=p.contract_id AND c.property_id=p.property_id
JOIN properties pr ON pr.id=p.property_id
ON CONFLICT(legacy_payment_id) DO NOTHING;

INSERT INTO invoice_items(property_id,invoice_id,item_type,description,unit_amount_minor,amount_minor,source_type,source_id,created_by,created_at)
SELECT i.property_id,i.id,x.item_type,x.description,x.amount,x.amount,'legacy_payment',i.legacy_payment_id,i.created_by,i.created_at
FROM invoices i
JOIN payments p ON p.id=i.legacy_payment_id
CROSS JOIN LATERAL (VALUES
    ('rent'::varchar,'Sewa',ROUND(p.amount_rent)::bigint),
    ('electricity'::varchar,'Listrik',ROUND(p.amount_electricity)::bigint),
    ('water'::varchar,'Air',ROUND(p.amount_water)::bigint),
    ('one_off'::varchar,'Biaya lain',ROUND(p.amount_other)::bigint)
) x(item_type,description,amount)
WHERE x.amount <> 0 AND NOT EXISTS (
    SELECT 1 FROM invoice_items ii WHERE ii.invoice_id=i.id AND ii.source_type='legacy_payment' AND ii.item_type=x.item_type
);

UPDATE payments p SET invoice_id=i.id FROM invoices i
WHERE i.legacy_payment_id=p.id AND p.invoice_id IS NULL;
ALTER TABLE payments VALIDATE CONSTRAINT payments_invoice_fkey;

CREATE INDEX IF NOT EXISTS idx_invoices_property_due_status ON invoices(property_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_period ON invoices(tenant_id,billing_period DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(property_id,invoice_id,created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_invoice ON invoice_allocations(property_id,invoice_id,status);
CREATE INDEX IF NOT EXISTS idx_invoice_credits_invoice ON invoice_credit_applications(property_id,invoice_id,status);
CREATE INDEX IF NOT EXISTS idx_meter_readings_period ON meter_readings(property_id,billing_period,contract_id);
CREATE INDEX IF NOT EXISTS idx_billing_jobs_property_period ON billing_job_runs(property_id,billing_period,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON invoice_events(property_id,invoice_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_policy_events_property ON billing_policy_events(property_id,created_at DESC);

COMMIT;
