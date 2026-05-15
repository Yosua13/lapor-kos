-- Add rental_duration to tenants
ALTER TABLE tenants ADD COLUMN rental_duration INTEGER DEFAULT 1;
