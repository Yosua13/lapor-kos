-- Migration 025: Notification Center, Delivery Platform, and Preferences (EPIC 08)
BEGIN;

-- 1. Enhance notification_outbox with deduplication, recipient identifiers, retry timing, and expanded statuses
ALTER TABLE notification_outbox DROP CONSTRAINT IF EXISTS notification_outbox_status_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_status_check 
    CHECK (status IN ('pending', 'processing', 'delivered', 'failed', 'partially_delivered', 'skipped', 'deduplicated'));

ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(255);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS channel VARCHAR(40) NOT NULL DEFAULT 'all';
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS dedup_key VARCHAR(150);
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent', 'normal', 'low'));
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE notification_outbox ADD COLUMN IF NOT EXISTS provider_ref VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_dedup ON notification_outbox(dedup_key) WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_outbox_recipient ON notification_outbox(recipient_id) WHERE recipient_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_outbox_retry ON notification_outbox(status, next_retry_at) WHERE status IN ('pending', 'failed');

-- 2. Notification Deliveries: record per-channel delivery attempts (in_app, whatsapp, email, push)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outbox_id UUID NOT NULL REFERENCES notification_outbox(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('in_app', 'whatsapp', 'email', 'push')),
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'delivered', 'failed', 'skipped_quiet_hours', 'opted_out', 'deduplicated')),
    provider_ref VARCHAR(100),
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_outbox ON notification_deliveries(outbox_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_property_status ON notification_deliveries(property_id, status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel_status ON notification_deliveries(channel, status);

-- 3. In-App Notifications: user inbox with categories, read tracking, and deep linking
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    outbox_id UUID REFERENCES notification_outbox(id) ON DELETE SET NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'billing', 'operations', 'complaint', 'contract', 'announcement', 'security')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(255),
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_inbox ON in_app_notifications(user_id, is_read, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_property ON in_app_notifications(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_category ON in_app_notifications(user_id, category) WHERE deleted_at IS NULL;

-- 4. Notification Preferences: user quiet hours, channel preferences, and category opt-outs
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quiet_hours_start VARCHAR(5) NOT NULL DEFAULT '22:00',
    quiet_hours_end VARCHAR(5) NOT NULL DEFAULT '07:00',
    quiet_hours_timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    opt_out_categories TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_preferences_global ON notification_preferences(user_id) WHERE property_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_preferences_property ON notification_preferences(user_id, property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user ON notification_preferences(user_id);

COMMIT;
