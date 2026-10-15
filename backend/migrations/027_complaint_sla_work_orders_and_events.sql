-- 027_complaint_sla_work_orders_and_events.sql
-- Epic 10: Complaint, SLA, Work Order, dan AI Advisory

-- 1. Extend complaints table with SLA, priority, triage, and assignment fields
ALTER TABLE complaints
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS impact VARCHAR(20) NOT NULL DEFAULT 'minor',
    ADD COLUMN IF NOT EXISTS access_window VARCHAR(150),
    ADD COLUMN IF NOT EXISTS preferred_contact VARCHAR(100),
    ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_response_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_status VARCHAR(20) NOT NULL DEFAULT 'within_sla';

-- Set SLA check constraints
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_complaints_priority') THEN
        ALTER TABLE complaints ADD CONSTRAINT check_complaints_priority
            CHECK (priority IN ('urgent', 'high', 'medium', 'low'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_complaints_impact') THEN
        ALTER TABLE complaints ADD CONSTRAINT check_complaints_impact
            CHECK (impact IN ('emergency', 'major', 'minor'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_complaints_sla_status') THEN
        ALTER TABLE complaints ADD CONSTRAINT check_complaints_sla_status
            CHECK (sla_status IN ('within_sla', 'warning', 'breached'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_complaints_status_flow') THEN
        ALTER TABLE complaints ADD CONSTRAINT check_complaints_status_flow
            CHECK (status IN ('pending', 'in_progress', 'scheduled', 'waiting_vendor', 'resolved', 'confirmed', 'reopened', 'cancelled', 'processed'));
    END IF;
END $$;

-- Indexes for complaint SLA and filtering
CREATE INDEX IF NOT EXISTS idx_complaints_property_priority ON complaints(property_id, priority);
CREATE INDEX IF NOT EXISTS idx_complaints_property_sla ON complaints(property_id, sla_status);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_to ON complaints(assigned_to);

-- 2. Complaint events table (Append-only immutable timeline)
CREATE TABLE IF NOT EXISTS complaint_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL DEFAULT 'Sistem',
    actor_role VARCHAR(50) NOT NULL DEFAULT 'system',
    event_type VARCHAR(50) NOT NULL, -- 'created', 'triaged', 'assigned', 'status_changed', 'comment_added', 'work_order_created', 'vendor_scheduled', 'resolved', 'confirmed', 'reopened', 'cost_updated'
    visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'internal')),
    message TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaint_events_complaint_id ON complaint_events(complaint_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_complaint_events_property_id ON complaint_events(property_id);
CREATE INDEX IF NOT EXISTS idx_complaint_events_visibility ON complaint_events(complaint_id, visibility);

-- 3. Vendors table (Property-scoped vendor directory)
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    service_type VARCHAR(100) NOT NULL, -- 'plumbing', 'electrical', 'ac', 'cleaning', 'carpentry', 'general', 'other'
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_property ON vendors(property_id, is_active);

-- 4. Work orders table (Maintenance vendor work orders)
CREATE TABLE IF NOT EXISTS work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled')),
    scheduled_date TIMESTAMPTZ,
    estimated_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    invoice_url TEXT,
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_orders_complaint ON work_orders(complaint_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_property ON work_orders(property_id, status);
CREATE INDEX IF NOT EXISTS idx_work_orders_vendor ON work_orders(vendor_id);

-- 5. AI Suggestions table (Advisory records with human override tracking)
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    suggested_category VARCHAR(50),
    suggested_priority VARCHAR(20),
    suggested_impact VARCHAR(20),
    summary TEXT,
    draft_response TEXT,
    recommended_action TEXT,
    confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0.85,
    model_version VARCHAR(50) NOT NULL DEFAULT 'gemini-1.5-flash',
    is_applied BOOLEAN NOT NULL DEFAULT FALSE,
    applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_complaint ON ai_suggestions(complaint_id);
