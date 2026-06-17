-- migrations/011_sync_inline_migrations.sql

-- Syncing inline migrations from main.go for users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS job VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS additional_doc_url TEXT;

-- Syncing inline migrations from main.go for contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payment_interval VARCHAR(50) NOT NULL DEFAULT 'monthly';
-- deposit is already in 005_contracts.sql but added here for safety based on inline migration
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS deposit DECIMAL(10,2) NOT NULL DEFAULT 0;
