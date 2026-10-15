-- EPIC 07: Checkout, Inspection, and Settlement Workflow
-- Implements end-to-end checkout management:
-- 1. Checkout cases (notices, dates, reasons, bank details)
-- 2. Room & asset checklist inspections (damages, repair costs, photos, key handover)
-- 3. Unified final settlement statements (deposits, outstanding invoices, damages, utilities, credits)
-- 4. Safe room status transition (no available status before inspection/handover without audit override)
-- 5. Atomic financial closure with refund requests or final adjustment invoices.

BEGIN;

-- 1. Relax payment_id in refund_requests to support deposit refunds from checkout settlements
ALTER TABLE refund_requests ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS checkout_id UUID;
CREATE INDEX IF NOT EXISTS idx_refund_requests_checkout ON refund_requests(checkout_id);

-- 2. Checkout Cases Table
CREATE TABLE IF NOT EXISTS checkout_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    room_id UUID NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted',
    scheduled_checkout_date DATE NOT NULL,
    actual_checkout_date DATE,
    reason TEXT NOT NULL DEFAULT '',
    forwarding_address TEXT NOT NULL DEFAULT '',
    bank_name VARCHAR(100) NOT NULL DEFAULT '',
    bank_account_number VARCHAR(100) NOT NULL DEFAULT '',
    bank_account_holder VARCHAR(100) NOT NULL DEFAULT '',
    inspection_notes TEXT NOT NULL DEFAULT '',
    inspected_by UUID REFERENCES users(id) ON DELETE SET NULL,
    inspected_at TIMESTAMPTZ,
    key_returned BOOLEAN NOT NULL DEFAULT FALSE,
    key_returned_at TIMESTAMPTZ,
    room_override BOOLEAN NOT NULL DEFAULT FALSE,
    room_override_reason TEXT NOT NULL DEFAULT '',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    cancellation_reason TEXT NOT NULL DEFAULT '',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checkout_cases_status_check
        CHECK (status IN ('submitted', 'inspection_scheduled', 'inspection_completed', 'settlement_pending', 'approved', 'completed', 'cancelled')),
    CONSTRAINT checkout_cases_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT checkout_cases_room_property_fkey
        FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT
);

-- At most one active (non-completed, non-cancelled) checkout case per contract
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkout_cases_active_contract
    ON checkout_cases(contract_id)
    WHERE status NOT IN ('completed', 'cancelled');

CREATE INDEX IF NOT EXISTS idx_checkout_cases_property_status
    ON checkout_cases(property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_cases_tenant
    ON checkout_cases(property_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_cases_room
    ON checkout_cases(property_id, room_id);

-- 3. Checklist Items & Physical Asset Inspection
CREATE TABLE IF NOT EXISTS checkout_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    checkout_id UUID NOT NULL REFERENCES checkout_cases(id) ON DELETE CASCADE,
    item_name VARCHAR(150) NOT NULL,
    condition VARCHAR(30) NOT NULL DEFAULT 'good'
        CHECK (condition IN ('good', 'fair', 'damaged', 'missing', 'dirty')),
    repair_cost_minor BIGINT NOT NULL DEFAULT 0 CHECK (repair_cost_minor >= 0),
    photo_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_inspections_case ON checkout_inspections(checkout_id);
CREATE INDEX IF NOT EXISTS idx_checkout_inspections_property ON checkout_inspections(property_id);

-- 4. Final Settlement Statements
CREATE TABLE IF NOT EXISTS checkout_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    checkout_id UUID NOT NULL REFERENCES checkout_cases(id) ON DELETE CASCADE,
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    deposit_held_minor BIGINT NOT NULL DEFAULT 0 CHECK (deposit_held_minor >= 0),
    unpaid_invoices_minor BIGINT NOT NULL DEFAULT 0 CHECK (unpaid_invoices_minor >= 0),
    prorata_rent_minor BIGINT NOT NULL DEFAULT 0 CHECK (prorata_rent_minor >= 0),
    damage_charges_minor BIGINT NOT NULL DEFAULT 0 CHECK (damage_charges_minor >= 0),
    utility_charges_minor BIGINT NOT NULL DEFAULT 0 CHECK (utility_charges_minor >= 0),
    credit_balance_minor BIGINT NOT NULL DEFAULT 0 CHECK (credit_balance_minor >= 0),
    other_charges_minor BIGINT NOT NULL DEFAULT 0 CHECK (other_charges_minor >= 0),
    net_settlement_minor BIGINT NOT NULL DEFAULT 0,
    settlement_type VARCHAR(30) NOT NULL
        CHECK (settlement_type IN ('refund', 'invoice', 'zero_balance')),
    deposit_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (deposit_status IN ('pending', 'refund_requested', 'refund_approved', 'applied_to_deductions', 'forfeited', 'zero_balance')),
    refund_request_id UUID REFERENCES refund_requests(id) ON DELETE SET NULL,
    final_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    calculation_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_checkout_settlements_case UNIQUE (checkout_id)
);

CREATE INDEX IF NOT EXISTS idx_checkout_settlements_property ON checkout_settlements(property_id);

-- 5. Foreign Key from refund_requests to checkout_cases
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'refund_requests_checkout_fkey'
    ) THEN
        ALTER TABLE refund_requests
            ADD CONSTRAINT refund_requests_checkout_fkey
            FOREIGN KEY (checkout_id) REFERENCES checkout_cases(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 6. Trigger to guard terminal state immutability for completed / cancelled checkout cases
CREATE OR REPLACE FUNCTION guard_checkout_case_terminal_state() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'checkout case is in terminal state (%) and cannot be modified', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS checkout_cases_terminal_guard ON checkout_cases;
CREATE TRIGGER checkout_cases_terminal_guard BEFORE UPDATE ON checkout_cases
FOR EACH ROW EXECUTE FUNCTION guard_checkout_case_terminal_state();

COMMIT;
