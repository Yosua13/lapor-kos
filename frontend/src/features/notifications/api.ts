import { apiFetch } from '@/lib/api';
import type {
  InAppNotificationListResponse,
  NotificationPreference,
  UpdatePreferencesRequest,
  OutboxListResponse,
  NotificationOutboxItem,
} from './types';

export const getNotifications = async (params?: {
  category?: string;
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}): Promise<InAppNotificationListResponse> => {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params?.unread_only) {
    query.set('unread_only', 'true');
  }
  if (params?.limit) {
    query.set('limit', params.limit.toString());
  }
  if (params?.offset) {
    query.set('offset', params.offset.toString());
  }

  const qs = query.toString();
  return apiFetch<InAppNotificationListResponse>(`/api/notifications${qs ? `?${qs}` : ''}`);
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await apiFetch<{ unread_count: number }>('/api/notifications/unread-count');
  return res.unread_count || 0;
};

export const markNotificationRead = async (id: string): Promise<void> => {
  await apiFetch(`/api/notifications/${id}/read`, {
    method: 'POST',
  });
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await apiFetch('/api/notifications/read-all', {
    method: 'POST',
  });
};

export const deleteNotification = async (id: string): Promise<void> => {
  await apiFetch(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
};

export const getNotificationPreferences = async (): Promise<NotificationPreference> => {
  return apiFetch<NotificationPreference>('/api/notifications/preferences');
};

export const updateNotificationPreferences = async (
  req: UpdatePreferencesRequest
): Promise<NotificationPreference> => {
  return apiFetch<NotificationPreference>('/api/notifications/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
};

export const getOutboxList = async (
  propertyId: string,
  params?: { status?: string; channel?: string; limit?: number; offset?: number }
): Promise<OutboxListResponse> => {
  const query = new URLSearchParams();
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.channel && params.channel !== 'all') {
    query.set('channel', params.channel);
  }
  if (params?.limit) {
    query.set('limit', params.limit.toString());
  }
  if (params?.offset) {
    query.set('offset', params.offset.toString());
  }

  const qs = query.toString();
  return apiFetch<OutboxListResponse>(`/api/v1/properties/${propertyId}/notifications/outbox${qs ? `?${qs}` : ''}`, {
    headers: { 'X-Property-ID': propertyId },
  });
};

export const getOutboxItem = async (
  propertyId: string,
  outboxId: string
): Promise<NotificationOutboxItem> => {
  return apiFetch<NotificationOutboxItem>(`/api/v1/properties/${propertyId}/notifications/outbox/${outboxId}`, {
    headers: { 'X-Property-ID': propertyId },
  });
};

export const retryOutboxItem = async (
  propertyId: string,
  outboxId: string
): Promise<NotificationOutboxItem> => {
  return apiFetch<NotificationOutboxItem>(`/api/v1/properties/${propertyId}/notifications/outbox/${outboxId}/retry`, {
    method: 'POST',
    headers: { 'X-Property-ID': propertyId },
  });
};
