import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotificationsPage from './page';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/notifications/preferences')) {
      return Promise.resolve({
        id: 'pref-001',
        user_id: 'usr-001',
        email_enabled: true,
        whatsapp_enabled: true,
        in_app_enabled: true,
        quiet_hours_enabled: false,
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00',
        quiet_hours_timezone: 'Asia/Jakarta',
        opt_out_categories: [],
        created_at: '2026-10-15T08:00:00Z',
        updated_at: '2026-10-15T08:00:00Z',
      });
    }
    if (url.includes('/api/notifications/unread-count')) {
      return Promise.resolve({ unread_count: 2 });
    }
    if (url.includes('/api/notifications')) {
      return Promise.resolve({
        notifications: [
          {
            id: 'notif-001',
            property_id: 'prop-001',
            user_id: 'usr-001',
            category: 'billing',
            title: 'Pembayaran Terverifikasi',
            message: 'Pembayaran invoice INV-001 telah diverifikasi oleh pengelola.',
            action_url: '/payments',
            is_read: false,
            created_at: '2026-10-15T08:00:00Z',
          },
          {
            id: 'notif-002',
            property_id: 'prop-001',
            user_id: 'usr-001',
            category: 'operations',
            title: 'Notice Checkout Didaftarkan',
            message: 'Notice checkout kamar 101 telah dicatat.',
            action_url: '/checkouts',
            is_read: true,
            read_at: '2026-10-15T09:00:00Z',
            created_at: '2026-10-15T07:30:00Z',
          },
        ],
        total_count: 2,
        unread_count: 1,
      });
    }
    return Promise.resolve({});
  }),
}));

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: () => ({
    activeProperty: {
      id: 'prop-001',
      name: 'Kost Bahagia',
      role: 'property_owner',
      permissions: ['*'],
    },
  }),
}));

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: () => ({
    can: () => true,
    isTenant: false,
    role: 'property_owner',
  }),
}));

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders notifications page header, tabs, and inbox content', async () => {
    render(<NotificationsPage />);
    expect(await screen.findByText(/Pusat Notifikasi & Delivery/i)).toBeInTheDocument();
    expect(screen.getByText(/Kotak Masuk \(Inbox\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Preferensi & Jam Tenang/i)).toBeInTheDocument();
    expect(screen.getByText(/Monitoring Pengiriman \(Outbox\)/i)).toBeInTheDocument();

    // Verify inbox item rendered
    expect(await screen.findByText('Pembayaran Terverifikasi')).toBeInTheDocument();
    expect(screen.getByText(/Pembayaran invoice INV-001/i)).toBeInTheDocument();
    expect(screen.getByText('Keuangan & Tagihan')).toBeInTheDocument();
  });
});
