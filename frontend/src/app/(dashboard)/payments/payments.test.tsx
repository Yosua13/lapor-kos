import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentsPage from './page';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/payments/my') || url.includes('/api/payments')) {
      return Promise.resolve([
        {
          id: 'pay-001',
          property_id: 'prop-001',
          contract_id: 'ctr-001',
          period_month: 10,
          period_year: 2026,
          amount_rent: 1500000,
          total_paid: 1500000,
          amount_minor: 1500000,
          paid_amount_minor: 1500000,
          currency: 'IDR',
          status: 'paid',
          due_date: '2026-10-05',
          payment_method: 'transfer',
          contract: {
            room: { room_number: '101' },
            user: { name: 'Budi Santoso' },
          },
        },
      ]);
    }
    return Promise.resolve([]);
  }),
  getImageUrl: vi.fn((path: string) => path),
}));

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: vi.fn().mockReturnValue({
    can: () => true,
    isTenant: false,
    role: 'property_owner',
  }),
}));

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: vi.fn().mockReturnValue({
    activeProperty: { id: 'prop-001', name: 'Kos Melati' },
  }),
}));

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders staff payments management title and tabs', async () => {
    render(<PaymentsPage />);
    expect(await screen.findByText('Manajemen Pembayaran & Rekonsiliasi')).toBeInTheDocument();
    expect(screen.getByText('Daftar Transaksi & Tagihan')).toBeInTheDocument();
    expect(screen.getByText('Laporan Rekonsiliasi Keuangan')).toBeInTheDocument();
  });

  it('renders payment records in the table', async () => {
    render(<PaymentsPage />);
    expect(await screen.findByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Kamar 101')).toBeInTheDocument();
    expect(screen.getAllByText('Lunas').length).toBeGreaterThan(0);
  });
});
