-- Migration 026: Visitor Permit and Overnight Guest Management (EPIC 09)
BEGIN;

-- 1. Create visitor_permits table
CREATE TABLE IF NOT EXISTS visitor_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    guest_name VARCHAR(120) NOT NULL,
    guest_phone VARCHAR(50),
    guest_id_card_last4 VARCHAR(10),
    relationship VARCHAR(50) NOT NULL,
    purpose TEXT NOT NULL,
    is_overnight BOOLEAN NOT NULL DEFAULT FALSE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_guests INT NOT NULL DEFAULT 1 CHECK (total_guests >= 1 AND total_guests <= 10),
    vehicle_type VARCHAR(20) NOT NULL DEFAULT 'tidak_ada' CHECK (vehicle_type IN ('tidak_ada', 'motor', 'mobil', 'lainnya')),
    vehicle_number VARCHAR(30),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'change_requested', 'active', 'completed', 'cancelled', 'expired')),
    pass_token VARCHAR(64) UNIQUE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ,
    checked_out_by UUID REFERENCES users(id) ON DELETE SET NULL,
    checked_out_at TIMESTAMPTZ,
    is_anonymized BOOLEAN NOT NULL DEFAULT FALSE,
    anonymized_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for visitor_permits
CREATE INDEX IF NOT EXISTS idx_visitor_permits_property_status ON visitor_permits(property_id, status);
CREATE INDEX IF NOT EXISTS idx_visitor_permits_tenant ON visitor_permits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_permits_contract ON visitor_permits(contract_id);
CREATE INDEX IF NOT EXISTS idx_visitor_permits_room ON visitor_permits(room_id);
CREATE INDEX IF NOT EXISTS idx_visitor_permits_dates ON visitor_permits(property_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_visitor_permits_pass_token ON visitor_permits(pass_token) WHERE pass_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visitor_permits_retention ON visitor_permits(property_id, updated_at) WHERE is_anonymized = FALSE;

-- 2. Create visitor_permit_events table (immutable audit trail)
CREATE TABLE IF NOT EXISTS visitor_permit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_permit_id UUID NOT NULL REFERENCES visitor_permits(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('submitted', 'approved', 'rejected', 'change_requested', 'checked_in', 'checked_out', 'cancelled', 'anonymized')),
    reason TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for visitor_permit_events
CREATE INDEX IF NOT EXISTS idx_visitor_permit_events_permit ON visitor_permit_events(visitor_permit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_permit_events_property ON visitor_permit_events(property_id, created_at);

COMMIT;
