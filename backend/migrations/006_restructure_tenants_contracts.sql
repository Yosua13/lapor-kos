-- 006_restructure_tenants_contracts.sql

-- Tambahkan kolom rental_duration dan total_price di contracts
ALTER TABLE contracts 
ADD COLUMN rental_duration INT NOT NULL DEFAULT 1,
ADD COLUMN total_price NUMERIC NOT NULL DEFAULT 0;

-- Hapus kolom entry_date dan rental_duration dari tenants
ALTER TABLE tenants 
DROP COLUMN entry_date,
DROP COLUMN rental_duration;
