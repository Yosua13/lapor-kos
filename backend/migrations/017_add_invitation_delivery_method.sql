-- EPIC 02 follow-up: an invitation can be delivered through email or WhatsApp.
BEGIN;

ALTER TABLE tenant_profiles ALTER COLUMN email DROP NOT NULL;
ALTER TABLE tenant_invitations
    ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(20) NOT NULL DEFAULT 'email',
    ADD CONSTRAINT tenant_invitations_delivery_method_check
        CHECK (delivery_method IN ('email', 'whatsapp'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_profiles_property_phone
    ON tenant_profiles(property_id, phone)
    WHERE phone <> '';

COMMIT;
