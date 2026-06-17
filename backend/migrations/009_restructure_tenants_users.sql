-- migrations/009_restructure_tenants_users.sql

-- 0. Hapus data lama karena kita tidak mempertahankan data (sesuai instruksi) dan menghindari konflik foreign key
TRUNCATE contracts CASCADE;
TRUNCATE complaints CASCADE;
TRUNCATE tenants CASCADE;

-- 1. Tambahkan field ke tabel users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ktp_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_url TEXT;

-- 2. Ubah tabel contracts
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_tenant_id_fkey;
ALTER TABLE contracts RENAME COLUMN tenant_id TO user_id;
-- Hapus FK jika sudah ada (karena error sebelumnya gagal add FK, kita pastikan bersih)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS contracts_user_id_fkey;
ALTER TABLE contracts ADD CONSTRAINT contracts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 3. Ubah tabel complaints
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_tenant_id_fkey;
ALTER TABLE complaints RENAME COLUMN tenant_id TO user_id;
-- Hapus FK jika sudah ada
ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_user_id_fkey;
ALTER TABLE complaints ADD CONSTRAINT complaints_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 4. Hapus index lama yang terkait dengan tenant_id
DROP INDEX IF EXISTS idx_complaints_tenant;
CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);

-- 5. Hapus tabel tenants beserta constraint/index yang tersisa
DROP TABLE IF EXISTS tenants CASCADE;
