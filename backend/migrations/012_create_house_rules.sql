-- migrations/012_create_house_rules.sql

CREATE TABLE IF NOT EXISTS house_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'keamanan', 'kebersihan', 'fasilitas', 'pembayaran', 'umum'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    details TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_house_rules_owner ON house_rules(owner_id);
