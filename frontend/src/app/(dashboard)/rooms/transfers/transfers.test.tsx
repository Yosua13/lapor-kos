import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RoomTransfersPage from './page';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/room-transfers')) {
      return Promise.resolve([
        {
          id: 'trf-001',
          property_id: 'prop-001',
          contract_id: 'ctr-001',
          tenant_id: 'usr-001',
          from_room_id: 'rm-001',
          to_room_id: 'rm-002',
          requested_by: 'usr-001',
          effective_date: '2026-11-01',
          target_end_date: '2026-12-31',
          status: 'pending',
          reason: 'Ingin pindah ke kamar lantai 2',
          calculation_preview: {
            from_room_number: '101',
            to_room_number: '205',
            rent_difference_minor: 300000,
            deposit_difference_minor: 0,
            move_fee_minor: 0,
            net_total_adjustment_minor: 300000,
            currency: 'IDR',
          },
          created_at: '2026-10-15T08:00:00Z',
          updated_at: '2026-10-15T08:00:00Z',
          tenant_name: 'Budi Santoso',
          from_room_number: '101',
          to_room_number: '205',
        },
      ]);
    }
    return Promise.resolve([]);
  }),
  getImageUrl: vi.fn((path: string) => path),
}));

describe('RoomTransfersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders room transfers management header and transfer cards', async () => {
    render(<RoomTransfersPage />);
    expect(await screen.findByText('Manajemen Pindah Kamar')).toBeInTheDocument();
    expect(await screen.findByText(/Kamar 101/)).toBeInTheDocument();
    expect(await screen.findByText(/Kamar 205/)).toBeInTheDocument();
    expect(screen.getAllByText('Menunggu Persetujuan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Setujui')).toBeInTheDocument();
    expect(screen.getByText('Tolak')).toBeInTheDocument();
  });
});
