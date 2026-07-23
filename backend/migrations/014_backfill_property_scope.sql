-- 014_backfill_property_scope.sql
-- Repeatable data phase. Review property_scope_migration_report and resolve all
-- blocking rows before applying 015. This script never assigns an ambiguous
-- room to a property merely because an owner happens to exist.

BEGIN;

-- Allocate one stable default property UUID for every legacy global owner.
INSERT INTO property_migration_owner_map (owner_id, property_id)
SELECT u.id, gen_random_uuid()
FROM users u
WHERE u.role = 'owner'
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO properties (
    id, name, address, timezone, currency, status, created_by
)
SELECT
    mapping.property_id,
    CASE
        WHEN btrim(u.name) = '' THEN 'Kos Utama'
        ELSE left(btrim(u.name) || ' - Kos Utama', 255)
    END,
    '',
    'Asia/Jakarta',
    'IDR',
    'active',
    u.id
FROM property_migration_owner_map mapping
JOIN users u ON u.id = mapping.owner_id
ON CONFLICT (id) DO NOTHING;

INSERT INTO property_memberships (
    property_id, user_id, role, permissions, status, created_by
)
SELECT mapping.property_id, mapping.owner_id, 'property_owner', '[]'::JSONB, 'active', mapping.owner_id
FROM property_migration_owner_map mapping
ON CONFLICT (property_id, user_id) DO NOTHING;

-- Contracts have the strongest legacy owner evidence.
UPDATE contracts contract
SET property_id = mapping.property_id
FROM property_migration_owner_map mapping
WHERE contract.property_id IS NULL
  AND contract.owner_id = mapping.owner_id;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'contract', contract.id, 'contract_owner_unmapped',
       jsonb_build_object('owner_id', contract.owner_id)
FROM contracts contract
WHERE contract.property_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

-- A room is safe to infer only when every property-scoped contract that has
-- referenced it agrees on exactly one property.
WITH room_candidates AS (
    SELECT
        contract.room_id,
        MIN(contract.property_id::TEXT)::UUID AS property_id,
        COUNT(DISTINCT contract.property_id) AS property_count
    FROM contracts contract
    WHERE contract.room_id IS NOT NULL
      AND contract.property_id IS NOT NULL
    GROUP BY contract.room_id
)
INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'room', candidate.room_id, 'room_has_conflicting_properties',
       jsonb_build_object(
           'property_count', candidate.property_count,
           'property_ids', (
               SELECT jsonb_agg(DISTINCT nested.property_id ORDER BY nested.property_id)
               FROM contracts nested
               WHERE nested.room_id = candidate.room_id
                 AND nested.property_id IS NOT NULL
           )
       )
FROM room_candidates candidate
WHERE candidate.property_count > 1
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

WITH room_candidates AS (
    SELECT
        contract.room_id,
        MIN(contract.property_id::TEXT)::UUID AS property_id
    FROM contracts contract
    WHERE contract.room_id IS NOT NULL
      AND contract.property_id IS NOT NULL
    GROUP BY contract.room_id
    HAVING COUNT(DISTINCT contract.property_id) = 1
)
UPDATE rooms room
SET property_id = candidate.property_id
FROM room_candidates candidate
WHERE room.id = candidate.room_id
  AND room.property_id IS NULL;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'room', room.id, 'room_has_no_property_evidence',
       jsonb_build_object('room_number', room.room_number)
FROM rooms room
WHERE room.property_id IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM property_migration_exceptions exception
      WHERE exception.entity_type = 'room'
        AND exception.entity_id = room.id
        AND exception.reason = 'room_has_conflicting_properties'
  )
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

-- Contract is canonical for legacy payment ownership. Record drift before
-- overwriting the redundant payment owner field's implied boundary.
INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'payment', payment.id, 'payment_owner_contract_owner_mismatch',
       jsonb_build_object(
           'payment_owner_id', payment.owner_id,
           'contract_owner_id', contract.owner_id,
           'contract_id', contract.id
       )
FROM payments payment
JOIN contracts contract ON contract.id = payment.contract_id
WHERE payment.owner_id IS DISTINCT FROM contract.owner_id
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

UPDATE payments payment
SET property_id = contract.property_id
FROM contracts contract
WHERE payment.contract_id = contract.id
  AND payment.property_id IS NULL
  AND contract.property_id IS NOT NULL;

-- Complaint owner and room evidence must agree when both are available.
INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'complaint', complaint.id, 'complaint_owner_room_property_mismatch',
       jsonb_build_object(
           'owner_property_id', mapping.property_id,
           'room_property_id', room.property_id,
           'owner_id', complaint.owner_id,
           'room_id', complaint.room_id
       )
FROM complaints complaint
JOIN property_migration_owner_map mapping ON mapping.owner_id = complaint.owner_id
JOIN rooms room ON room.id = complaint.room_id
WHERE room.property_id IS NOT NULL
  AND room.property_id <> mapping.property_id
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

UPDATE complaints complaint
SET property_id = mapping.property_id
FROM property_migration_owner_map mapping
WHERE complaint.property_id IS NULL
  AND mapping.owner_id = complaint.owner_id
  AND NOT EXISTS (
      SELECT 1
      FROM rooms room
      WHERE room.id = complaint.room_id
        AND room.property_id IS NOT NULL
        AND room.property_id <> mapping.property_id
  );

UPDATE house_rules rule
SET property_id = mapping.property_id
FROM property_migration_owner_map mapping
WHERE rule.property_id IS NULL
  AND rule.owner_id = mapping.owner_id;

-- Record all remaining null boundaries. Operators may set property_id directly
-- after business review and mark the matching exception resolved.
INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'payment', payment.id, 'payment_property_unmapped',
       jsonb_build_object('contract_id', payment.contract_id)
FROM payments payment
WHERE payment.property_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'complaint', complaint.id, 'complaint_property_unmapped',
       jsonb_build_object('owner_id', complaint.owner_id, 'room_id', complaint.room_id)
FROM complaints complaint
WHERE complaint.property_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'house_rule', rule.id, 'house_rule_property_unmapped',
       jsonb_build_object('owner_id', rule.owner_id)
FROM house_rules rule
WHERE rule.property_id IS NULL
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

-- Permanent public URLs cannot be made private by assigning property_id. These
-- rows remain visible in the exception report until objects are copied to a
-- private bucket and represented by files metadata.
INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'payment', payment.id, 'legacy_public_file_requires_private_migration',
       jsonb_build_object('field', 'proof_photo_url', 'property_id', payment.property_id)
FROM payments payment
WHERE COALESCE(payment.proof_photo_url, '') <> ''
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'complaint', complaint.id, 'legacy_public_file_requires_private_migration',
       jsonb_build_object('field', 'photo_url', 'property_id', complaint.property_id)
FROM complaints complaint
WHERE COALESCE(complaint.photo_url, '') <> ''
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

INSERT INTO property_migration_exceptions (entity_type, entity_id, reason, details)
SELECT 'user', user_record.id, 'legacy_public_identity_files_require_private_migration',
       jsonb_build_object(
           'has_ktp', COALESCE(user_record.ktp_url, '') <> '',
           'has_selfie', COALESCE(user_record.selfie_url, '') <> '',
           'has_additional_doc', COALESCE(user_record.additional_doc_url, '') <> ''
       )
FROM users user_record
WHERE COALESCE(user_record.ktp_url, '') <> ''
   OR COALESCE(user_record.selfie_url, '') <> ''
   OR COALESCE(user_record.additional_doc_url, '') <> ''
ON CONFLICT (entity_type, entity_id, reason) DO NOTHING;

CREATE OR REPLACE VIEW property_scope_migration_report AS
SELECT 'rooms'::TEXT AS entity_type,
       COUNT(*)::BIGINT AS total_rows,
       COUNT(*) FILTER (WHERE property_id IS NULL)::BIGINT AS unmapped_rows,
       (SELECT COUNT(*) FROM property_migration_exceptions e
        WHERE e.entity_type = 'room' AND e.resolved_at IS NULL)::BIGINT AS unresolved_exceptions
FROM rooms
UNION ALL
SELECT 'contracts', COUNT(*), COUNT(*) FILTER (WHERE property_id IS NULL),
       (SELECT COUNT(*) FROM property_migration_exceptions e
        WHERE e.entity_type = 'contract' AND e.resolved_at IS NULL)
FROM contracts
UNION ALL
SELECT 'payments', COUNT(*), COUNT(*) FILTER (WHERE property_id IS NULL),
       (SELECT COUNT(*) FROM property_migration_exceptions e
        WHERE e.entity_type = 'payment' AND e.resolved_at IS NULL)
FROM payments
UNION ALL
SELECT 'complaints', COUNT(*), COUNT(*) FILTER (WHERE property_id IS NULL),
       (SELECT COUNT(*) FROM property_migration_exceptions e
        WHERE e.entity_type = 'complaint' AND e.resolved_at IS NULL)
FROM complaints
UNION ALL
SELECT 'house_rules', COUNT(*), COUNT(*) FILTER (WHERE property_id IS NULL),
       (SELECT COUNT(*) FROM property_migration_exceptions e
        WHERE e.entity_type = 'house_rule' AND e.resolved_at IS NULL)
FROM house_rules;

COMMIT;
