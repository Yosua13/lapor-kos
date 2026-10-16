-- 029_property_finance_expenses_and_reports.sql
-- Property finance, expenses management, period closures, adjustment audit trails, and export jobs.

-- 1. Finance Period Closures
CREATE TABLE IF NOT EXISTS finance_period_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    period_key VARCHAR(7) NOT NULL, -- Format: YYYY-MM e.g. '2026-10'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'locked', 'reopened')),
    closed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reopened_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reopened_at TIMESTAMPTZ,
    reopen_reason TEXT NOT NULL DEFAULT '',
    summary_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_finance_period_property UNIQUE (property_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_finance_period_property ON finance_period_closures(property_id);
CREATE INDEX IF NOT EXISTS idx_finance_period_start_end ON finance_period_closures(period_start, period_end);

-- 2. Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    expense_number VARCHAR(60) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'maintenance', 'utilities', 'cleaning', 'supplies', 'operational', 'tax_legal', 'marketing', 'staff_salary', 'other'
    )),
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    vendor_name VARCHAR(150) NOT NULL DEFAULT '',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    expense_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'recorded' CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'rejected', 'paid', 'cancelled'
    )),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'bank_transfer',
    proof_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_interval VARCHAR(20) DEFAULT NULL CHECK (recurring_interval IS NULL OR recurring_interval IN ('monthly', 'quarterly', 'yearly')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    rejection_reason TEXT NOT NULL DEFAULT '',
    period_close_id UUID REFERENCES finance_period_closures(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_expenses_property_number UNIQUE (property_id, expense_number)
);

CREATE INDEX IF NOT EXISTS idx_expenses_property ON expenses(property_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(property_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(property_id, category);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(property_id, status);
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON expenses(property_id, vendor_id);

-- 3. Finance Period Adjustments (Post-closure adjustments)
CREATE TABLE IF NOT EXISTS finance_period_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    period_close_id UUID NOT NULL REFERENCES finance_period_closures(id) ON DELETE CASCADE,
    adjustment_number VARCHAR(60) NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN (
        'expense_adjustment', 'revenue_correction', 'deposit_adjustment', 'write_off', 'other'
    )),
    amount_minor BIGINT NOT NULL, -- Can be positive or negative
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_finance_adjustment_number UNIQUE (property_id, adjustment_number)
);

CREATE INDEX IF NOT EXISTS idx_finance_adj_property ON finance_period_adjustments(property_id);
CREATE INDEX IF NOT EXISTS idx_finance_adj_period ON finance_period_adjustments(period_close_id);

-- 4. Finance Adjustment Audit Trail (Events)
CREATE TABLE IF NOT EXISTS finance_period_adjustment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES finance_period_adjustments(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'requested', 'approved', 'rejected', 'note_added'
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_adj_events ON finance_period_adjustment_events(adjustment_id);

-- 5. Finance Export Jobs (Background / large report exports)
CREATE TABLE IF NOT EXISTS finance_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
        'cash_flow', 'receivables_aging', 'expense_summary', 'income_statement', 'full_ledger'
    )),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    export_format VARCHAR(10) NOT NULL CHECK (export_format IN ('csv', 'pdf')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_name TEXT NOT NULL,
    file_content TEXT NOT NULL DEFAULT '',
    total_rows INT NOT NULL DEFAULT 0,
    checksum_sha256 TEXT NOT NULL DEFAULT '',
    error_message TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_finance_export_property ON finance_export_jobs(property_id);
CREATE INDEX IF NOT EXISTS idx_finance_export_user ON finance_export_jobs(requested_by);

-- 6. Trigger to prevent tampering with approved adjustments
CREATE OR REPLACE FUNCTION protect_approved_finance_adjustment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('approved', 'rejected') AND NEW.status != OLD.status THEN
        RAISE EXCEPTION 'Cannot modify financial adjustment once finalized with status %', OLD.status;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_approved_finance_adjustment ON finance_period_adjustments;
CREATE TRIGGER trg_protect_approved_finance_adjustment
BEFORE UPDATE ON finance_period_adjustments
FOR EACH ROW
EXECUTE FUNCTION protect_approved_finance_adjustment();
