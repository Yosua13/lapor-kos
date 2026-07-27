-- EPIC 02: operational tenant data belongs to the property-scoped profile,
-- not to the global account identity. This prevents one property's owner from
-- changing or reading another property's tenant details through users.
BEGIN;

ALTER TABLE tenant_profiles
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
    ADD COLUMN IF NOT EXISTS job VARCHAR(100),
    ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_relation VARCHAR(50),
    ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100);

-- Preserve existing operational details as a snapshot for each historical
-- tenancy. New updates write only to tenant_profiles.
UPDATE tenant_profiles profile
SET
    date_of_birth = COALESCE(profile.date_of_birth, account.date_of_birth),
    gender = COALESCE(profile.gender, account.gender),
    job = COALESCE(profile.job, account.job),
    emergency_contact_phone = COALESCE(profile.emergency_contact_phone, account.emergency_contact_phone),
    emergency_contact_relation = COALESCE(profile.emergency_contact_relation, account.emergency_contact_relation),
    emergency_contact_name = COALESCE(profile.emergency_contact_name, account.emergency_contact_name),
    updated_at = NOW()
FROM users account
WHERE profile.user_id = account.id;

COMMIT;
