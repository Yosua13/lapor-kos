import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenantRoomHistory } from './TenantRoomHistory';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/room-history')) {
      return Promise.resolve([
        {
          id: 'occ-001',
          property_id: 'prop-001',
          contract_id: 'ctr-001',
          room_id: 'rm-102',
          room_number: '102',
          room_type: 'Standard',
          price_per_month_minor: 1800000,
          user_id: 'usr-001',
          tenant_name: 'Budi Santoso',
          start_date: '2026-10-15',
          end_date: '2026-12-31',
          is_current: true,
          transfer_reason: 'Pindah ke lantai 1',
          created_at: '2026-10-15T09:00:00Z',
        },
        {
          id: 'occ-002',
          property_id: 'prop-001',
          contract_id: 'ctr-001',
          room_id: 'rm-101',
          room_number: '101',
          room_type: 'Standard',
          price_per_month_minor: 1500000,
          user_id: 'usr-001',
          tenant_name: 'Budi Santoso',
          start_date: '2026-06-01',
          end_date: '2026-10-14',
          closed_at: '2026-10-15T09:00:00Z',
          is_current: false,
          created_at: '2026-06-01T00:00:00Z',
        },
      ]);
    }
    return Promise.resolve([]);
  }),
}));

describe('TenantRoomHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders tenant room history with current and past rooms', async () => {
    render(<TenantRoomHistory tenantId="usr-001" isTenant={false} />);

    expect(await screen.findByText('Histori Kamar Penghuni')).toBeInTheDocument();
    expect(await screen.findByText('Kamar 102')).toBeInTheDocument();
    expect(screen.getByText('Hunian Saat Ini')).toBeInTheDocument();
    expect(screen.getByText('Kamar 101')).toBeInTheDocument();
    expect(screen.getByText('Selesai')).toBeInTheDocument();
    expect(screen.getByText(/Pindah ke lantai 1/)).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });
});
