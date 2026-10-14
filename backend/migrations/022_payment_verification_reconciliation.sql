-- EPIC 05: Payment, Verification, and Reconciliation
-- Separates payment transactions from invoices, supporting full, partial,
-- multi-invoice allocations, overpayment credits, refund tracking,
-- idempotent webhook processing, immutable receipts, and reconciliation reporting.

BEGIN;

-- 1. Extend payments table for transaction semantics, minor unit precision, and provider idempotency
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_amount_minor BIGINT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'IDR';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'manual';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(100);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verification_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS parent_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL;

-- Backfill tenant_id from contract if missing
UPDATE payments p
SET tenant_id = c.user_id
FROM contracts c
WHERE p.contract_id = c.id AND p.tenant_id IS NULL;

-- Backfill amount_minor and paid_amount_minor from numeric columns
UPDATE payments
SET amount_minor = ROUND(COALESCE(amount_rent, 0) + COALESCE(amount_electricity, 0) + COALESCE(amount_water, 0) + COALESCE(amount_other, 0))
WHERE amount_minor = 0;

UPDATE payments
SET paid_amount_minor = ROUND(COALESCE(total_paid, 0))
WHERE paid_amount_minor = 0;

-- Idempotency unique index: prevents duplicate transaction creation on webhook retries
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_ref
ON payments (property_id, provider, provider_ref)
WHERE provider_ref IS NOT NULL AND provider_ref <> '';

-- 2. Payment Proofs: preserves all uploaded proofs for partial payments
CREATE TABLE IF NOT EXISTS payment_proofs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'transfer',
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment ON payment_proofs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_proofs_property ON payment_proofs(property_id);

-- Backfill initial payment_proofs from existing payments
INSERT INTO payment_proofs (property_id, payment_id, file_url, amount_minor, payment_method, submitted_by, notes, created_at)
SELECT p.property_id, p.id, p.proof_photo_url, COALESCE(p.paid_amount_minor, 0), COALESCE(p.payment_method, 'transfer'), p.tenant_id, COALESCE(p.notes, ''), COALESCE(p.paid_at, p.created_at)
FROM payments p
WHERE p.proof_photo_url IS NOT NULL AND p.proof_photo_url <> ''
ON CONFLICT DO NOTHING;

-- 3. Payment Receipts: immutable official payment receipt snapshots with SHA-256 checksums
CREATE TABLE IF NOT EXISTS payment_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(60) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
    checksum VARCHAR(64) NOT NULL,
    issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_property ON payment_receipts(property_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant ON payment_receipts(tenant_id);

CREATE OR REPLACE FUNCTION reject_receipt_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'payment_receipts is immutable; receipt % cannot be modified or deleted', OLD.receipt_number;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_receipts_guard ON payment_receipts;
CREATE TRIGGER payment_receipts_guard BEFORE UPDATE OR DELETE ON payment_receipts
FOR EACH ROW EXECUTE FUNCTION reject_receipt_mutation();

-- 4. Tenant Credits: ledger for tenant credit balance (overpayments, deposits returned, adjustments)
CREATE TABLE IF NOT EXISTS tenant_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    source_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount_minor BIGINT NOT NULL,
    balance_after_minor BIGINT NOT NULL CHECK (balance_after_minor >= 0),
    reason TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_credits_property_tenant ON tenant_credits(property_id, tenant_id);

CREATE OR REPLACE FUNCTION reject_credit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'tenant_credits is immutable; credit ledger entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_credits_guard ON tenant_credits;
CREATE TRIGGER tenant_credits_guard BEFORE UPDATE OR DELETE ON tenant_credits
FOR EACH ROW EXECUTE FUNCTION reject_credit_mutation();

-- 5. Refund Requests: tracking refund workflow (requested, approved, rejected, disbursed)
CREATE TABLE IF NOT EXISTS refund_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','disbursed')),
    reason TEXT NOT NULL,
    bank_name VARCHAR(100) NOT NULL DEFAULT '',
    bank_account_number VARCHAR(100) NOT NULL DEFAULT '',
    bank_account_holder VARCHAR(100) NOT NULL DEFAULT '',
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ,
    disbursement_ref VARCHAR(100) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_property ON refund_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_payment ON refund_requests(payment_id);

-- 6. Notification Outbox: event outbox for payment notifications and integration events
CREATE TABLE IF NOT EXISTS notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    event_type VARCHAR(60) NOT NULL,
    aggregate_type VARCHAR(30) NOT NULL DEFAULT 'payment',
    aggregate_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','delivered','failed')),
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending ON notification_outbox(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_outbox_property ON notification_outbox(property_id);

-- 7. Trigger to keep invoice status updated on invoice_allocations change
CREATE OR REPLACE FUNCTION sync_invoice_status_on_allocation() RETURNS trigger AS $$
DECLARE
    target_invoice_id UUID;
    v_total_minor BIGINT;
    v_allocated_minor BIGINT;
    v_credit_minor BIGINT;
BEGIN
    target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    IF target_invoice_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT total_minor INTO v_total_minor FROM invoices WHERE id = target_invoice_id;
    IF v_total_minor IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(amount_minor), 0) INTO v_allocated_minor
    FROM invoice_allocations
    WHERE invoice_id = target_invoice_id AND status = 'valid';

    SELECT COALESCE(SUM(amount_minor), 0) INTO v_credit_minor
    FROM invoice_credit_applications
    WHERE invoice_id = target_invoice_id AND status = 'valid';

    IF (v_allocated_minor + v_credit_minor) >= v_total_minor AND v_total_minor > 0 THEN
        UPDATE invoices SET status = 'paid' WHERE id = target_invoice_id AND status NOT IN ('paid', 'void');
    ELSIF (v_allocated_minor + v_credit_minor) > 0 THEN
        UPDATE invoices SET status = 'partially_paid' WHERE id = target_invoice_id AND status NOT IN ('partially_paid', 'void');
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoice_allocations_sync_status ON invoice_allocations;
CREATE TRIGGER invoice_allocations_sync_status AFTER INSERT OR UPDATE ON invoice_allocations
FOR EACH ROW EXECUTE FUNCTION sync_invoice_status_on_allocation();

COMMIT;
