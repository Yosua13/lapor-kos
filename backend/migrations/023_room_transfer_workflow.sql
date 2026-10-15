-- EPIC 06: Pindah Kamar Terintegrasi
-- Workflow terintegrasi perpindahan kamar yang mempertahankan histori hunian (occupancy),
-- concurrency reservation lock, preview perubahan biaya (prorata sewa, utility, deposit, fee),
-- adjustment invoices, dan notification outbox.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Table room_transfers
CREATE TABLE IF NOT EXISTS room_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    contract_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    from_room_id UUID NOT NULL,
    to_room_id UUID NOT NULL,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    effective_date DATE NOT NULL,
    target_end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'completed', 'rejected', 'cancelled')),
    reason TEXT NOT NULL,
    rejection_reason TEXT NOT NULL DEFAULT '',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    calculation_preview JSONB NOT NULL DEFAULT '{}'::JSONB,
    adjustment_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT room_transfers_contract_property_fkey
        FOREIGN KEY (property_id, contract_id) REFERENCES contracts(property_id, id) ON DELETE RESTRICT,
    CONSTRAINT room_transfers_from_room_property_fkey
        FOREIGN KEY (from_room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT,
    CONSTRAINT room_transfers_to_room_property_fkey
        FOREIGN KEY (to_room_id, property_id) REFERENCES rooms(id, property_id) ON DELETE RESTRICT,
    CONSTRAINT room_transfers_diff_rooms CHECK (from_room_id <> to_room_id),
    CONSTRAINT room_transfers_dates_check CHECK (target_end_date >= effective_date)
);

-- AC 1: Concurrency exclusion control
-- Dua perpindahan menuju kamar dan periode yang sama tidak dapat sukses bersamaan saat pending / approved.
ALTER TABLE room_transfers DROP CONSTRAINT IF EXISTS room_transfers_target_no_overlap;
ALTER TABLE room_transfers ADD CONSTRAINT room_transfers_target_no_overlap EXCLUDE USING gist (
    property_id WITH =,
    to_room_id WITH =,
    daterange(effective_date, target_end_date, '[]') WITH &&
) WHERE (status IN ('pending', 'approved'));

-- 2. Relax invoices_period_unique for adjustments so multiple adjustments can exist in a period
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_period_unique;
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_recurring_period
    ON invoices(property_id, contract_id, billing_period, invoice_type)
    WHERE invoice_type IN ('initial', 'recurring', 'final_settlement');

-- 3. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_room_transfers_property_status
    ON room_transfers(property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_transfers_tenant
    ON room_transfers(property_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_transfers_contract
    ON room_transfers(property_id, contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_transfers_to_room
    ON room_transfers(property_id, to_room_id);

-- 4. Immutable audit guard for completed/rejected room transfers
CREATE OR REPLACE FUNCTION guard_room_transfer_terminal_state() RETURNS trigger AS $$
BEGIN
    IF OLD.status IN ('completed', 'rejected', 'cancelled') THEN
        RAISE EXCEPTION 'room transfer is in terminal state (%) and cannot be modified', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_transfers_terminal_state_guard ON room_transfers;
CREATE TRIGGER room_transfers_terminal_state_guard BEFORE UPDATE ON room_transfers
FOR EACH ROW EXECUTE FUNCTION guard_room_transfer_terminal_state();

COMMIT;
