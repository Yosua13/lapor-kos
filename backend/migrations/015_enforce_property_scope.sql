-- 015_enforce_property_scope.sql
-- Contract phase. Apply only after reviewing property_scope_migration_report,
-- resolving ambiguous mappings, and reconciling business totals.

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM rooms WHERE property_id IS NULL)
       OR EXISTS (SELECT 1 FROM contracts WHERE property_id IS NULL)
       OR EXISTS (SELECT 1 FROM payments WHERE property_id IS NULL)
       OR EXISTS (SELECT 1 FROM complaints WHERE property_id IS NULL)
       OR EXISTS (SELECT 1 FROM house_rules WHERE property_id IS NULL) THEN
        RAISE EXCEPTION 'property scope enforcement blocked: unmapped operational rows remain; review property_scope_migration_report';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM property_migration_exceptions
        WHERE resolved_at IS NULL
          AND reason IN (
              'contract_owner_unmapped',
              'room_has_conflicting_properties',
              'room_has_no_property_evidence',
              'payment_property_unmapped',
              'complaint_owner_room_property_mismatch',
              'complaint_property_unmapped',
              'house_rule_property_unmapped'
          )
    ) THEN
        RAISE EXCEPTION 'property scope enforcement blocked: unresolved boundary exceptions remain';
    END IF;

    IF EXISTS (
        SELECT property_id, room_number
        FROM rooms
        GROUP BY property_id, room_number
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'property scope enforcement blocked: duplicate room_number exists inside a property';
    END IF;

    IF EXISTS (
        SELECT contract_id, period_month, period_year
        FROM payments
        GROUP BY contract_id, period_month, period_year
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'property scope enforcement blocked: duplicate contract billing period exists';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM properties property
        WHERE property.status <> 'archived'
          AND NOT EXISTS (
              SELECT 1
              FROM property_memberships membership
              WHERE membership.property_id = property.id
                AND membership.role = 'property_owner'
                AND membership.status = 'active'
          )
    ) THEN
        RAISE EXCEPTION 'property scope enforcement blocked: a property has no active property_owner';
    END IF;
END $$;

ALTER TABLE rooms ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE complaints ALTER COLUMN property_id SET NOT NULL;
ALTER TABLE house_rules ALTER COLUMN property_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_migration_owner_map_property_fkey') THEN
        ALTER TABLE property_migration_owner_map
            ADD CONSTRAINT property_migration_owner_map_property_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_property_id_fkey') THEN
        ALTER TABLE rooms
            ADD CONSTRAINT rooms_property_id_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_property_id_fkey') THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_property_id_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_property_id_fkey') THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_property_id_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_property_id_fkey') THEN
        ALTER TABLE complaints
            ADD CONSTRAINT complaints_property_id_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'house_rules_property_id_fkey') THEN
        ALTER TABLE house_rules
            ADD CONSTRAINT house_rules_property_id_fkey
            FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE RESTRICT NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contracts_room_property_fkey') THEN
        ALTER TABLE contracts
            ADD CONSTRAINT contracts_room_property_fkey
            FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id)
            ON DELETE SET NULL (room_id) NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_contract_property_fkey') THEN
        ALTER TABLE payments
            ADD CONSTRAINT payments_contract_property_fkey
            FOREIGN KEY (contract_id, property_id) REFERENCES contracts(id, property_id)
            ON DELETE CASCADE NOT VALID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'complaints_room_property_fkey') THEN
        ALTER TABLE complaints
            ADD CONSTRAINT complaints_room_property_fkey
            FOREIGN KEY (room_id, property_id) REFERENCES rooms(id, property_id)
            ON DELETE RESTRICT NOT VALID;
    END IF;
END $$;

ALTER TABLE property_migration_owner_map VALIDATE CONSTRAINT property_migration_owner_map_property_fkey;
ALTER TABLE rooms VALIDATE CONSTRAINT rooms_property_id_fkey;
ALTER TABLE contracts VALIDATE CONSTRAINT contracts_property_id_fkey;
ALTER TABLE payments VALIDATE CONSTRAINT payments_property_id_fkey;
ALTER TABLE complaints VALIDATE CONSTRAINT complaints_property_id_fkey;
ALTER TABLE house_rules VALIDATE CONSTRAINT house_rules_property_id_fkey;
ALTER TABLE contracts VALIDATE CONSTRAINT contracts_room_property_fkey;
ALTER TABLE payments VALIDATE CONSTRAINT payments_contract_property_fkey;
ALTER TABLE complaints VALIDATE CONSTRAINT complaints_room_property_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rooms_property_room_number
    ON rooms(property_id, room_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_contract_period
    ON payments(contract_id, period_month, period_year);

COMMIT;
