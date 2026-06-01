-- migrations/008_create_complaints.sql

-- 1. Tambah kolom whatsapp_group_link ke tabel users
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_group_link VARCHAR(255);

-- 2. Buat tabel complaints
CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'noisy', 'facility', 'cleanliness', 'security', 'other'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processed', 'resolved'
  photo_url TEXT,
  ai_response TEXT,
  wa_sent BOOLEAN DEFAULT FALSE,
  wa_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_complaints_tenant ON complaints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_owner ON complaints(owner_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
