import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GuestPermitsPage from './page';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { useActiveProperty } from '@/features/properties/PropertyProvider';

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: vi.fn(),
}));

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/visitor-permits/summary')) {
      return Promise.resolve({
        data: {
          total_today: 3,
          active_count: 1,
          pending_count: 2,
          overstay_count: 0,
          rejected_count: 0,
        },
      });
    }
    if (url.includes('/api/visitor-permits')) {
      return Promise.resolve({
        data: [
          {
            id: 'vp-001',
            property_id: 'prop-001',
            tenant_id: 'usr-001',
            contract_id: 'ctr-001',
            room_id: 'rm-101',
            guest_name: 'Budi Santoso',
            relationship: 'Teman',
            purpose: 'Kerja kelompok',
            is_overnight: false,
            start_time: '2026-10-20T14:00:00Z',
            end_time: '2026-10-20T18:00:00Z',
            total_guests: 1,
            vehicle_type: 'motor',
            vehicle_number: 'B 1234 CD',
            status: 'approved',
            pass_token: 'VP-TEST1234',
            created_at: '2026-10-15T08:00:00Z',
            updated_at: '2026-10-15T08:00:00Z',
            tenant_name: 'Andi Penyewa',
            room_number: '101',
            property_name: 'Kost Mawar',
            is_overstay: false,
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
      });
    }
    return Promise.resolve({ data: [] });
  }),
}));

describe('GuestPermitsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useActiveProperty).mockReturnValue({
      activeProperty: { id: 'prop-001', name: 'Kost Mawar' } as any,
      properties: [],
      isLoading: false,
      error: null,
      scopeVersion: 0,
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
    });
  });

  it('renders staff guest permits page header and permits list', async () => {
    vi.mocked(useAuthorization).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isTenant: false,
      role: 'property_owner',
    });

    render(<GuestPermitsPage />);
    expect(await screen.findByText(/Izin Tamu & Kerabat Menginap/i)).toBeInTheDocument();
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText(/Kamar 101/i)).toBeInTheDocument();
    expect(screen.getAllByText('Disetujui').length).toBeGreaterThan(0);
    expect(screen.getByText('Kunjungan Hari Ini')).toBeInTheDocument();
  });

  it('renders tenant guest permits page with create button', async () => {
    vi.mocked(useAuthorization).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isTenant: true,
      role: null,
    });

    render(<GuestPermitsPage />);
    expect(await screen.findByText(/Izin Tamu & Kerabat Menginap/i)).toBeInTheDocument();
    expect(await screen.findByText(/Ajukan Izin Tamu/i)).toBeInTheDocument();
  });
});
