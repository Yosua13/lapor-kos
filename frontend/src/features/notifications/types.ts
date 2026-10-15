export type NotificationCategory =
  | 'general'
  | 'billing'
  | 'operations'
  | 'complaint'
  | 'contract'
  | 'announcement'
  | 'security';

export interface InAppNotification {
  id: string;
  property_id?: string;
  user_id: string;
  outbox_id?: string;
  category: NotificationCategory;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  deleted_at?: string;
}

export interface InAppNotificationListResponse {
  notifications: InAppNotification[];
  total_count: number;
  unread_count: number;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  property_id?: string;
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  in_app_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  quiet_hours_timezone: string;
  opt_out_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface UpdatePreferencesRequest {
  email_enabled?: boolean;
  whatsapp_enabled?: boolean;
  in_app_enabled?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  quiet_hours_timezone?: string;
  opt_out_categories?: string[];
}

export type OutboxStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'failed'
  | 'partially_delivered'
  | 'skipped'
  | 'deduplicated';

export type DeliveryStatus =
  | 'pending'
  | 'delivered'
  | 'failed'
  | 'skipped_quiet_hours'
  | 'opted_out'
  | 'deduplicated';

export interface DeliveryRecord {
  id: string;
  outbox_id: string;
  property_id: string;
  channel: 'in_app' | 'whatsapp' | 'email' | 'push';
  recipient: string;
  status: DeliveryStatus;
  provider_ref?: string;
  error_message?: string;
  retry_count: number;
  next_retry_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface NotificationOutboxItem {
  id: string;
  property_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  recipient_id?: string;
  recipient_phone?: string;
  recipient_email?: string;
  channel: string;
  dedup_key?: string;
  priority: 'urgent' | 'normal' | 'low';
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retry_count: number;
  last_error?: string;
  next_retry_at?: string;
  provider_ref?: string;
  created_at: string;
  delivered_at?: string;
  deliveries?: DeliveryRecord[];
}

export interface OutboxListResponse {
  items: NotificationOutboxItem[];
  total_count: number;
}
