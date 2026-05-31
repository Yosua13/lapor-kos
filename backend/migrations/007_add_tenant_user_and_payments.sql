-- migrations/007_add_tenant_user_and_payments.sql

-- 1. Hubungkan tabel tenants ke tabel users
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Buat tabel payments untuk mencatat tagihan dan pembayaran
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  amount_rent NUMERIC(12,2) DEFAULT 0,
  amount_electricity NUMERIC(12,2) DEFAULT 0,
  amount_water NUMERIC(12,2) DEFAULT 0,
  amount_other NUMERIC(12,2) DEFAULT 0,
  total_paid NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR(30), -- 'cash', 'transfer', 'ovo', 'gopay', 'qris'
  status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'pending', 'paid', 'partial', 'overdue'
  proof_photo_url TEXT,
  paid_at TIMESTAMPTZ,
  due_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk mempercepat query pencarian tagihan
CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
