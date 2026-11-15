import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PaymentsPage from './page';
import { apiFetch } from '@/lib/api';
import { useAuthorization } from '@/features/authorization/useAuthorization';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
  getImageUrl: vi.fn((path: string) => path),
}));

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: vi.fn(),
}));

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: vi.fn().mockReturnValue({
    activeProperty: { id: 'prop-001', name: 'Kos Melati' },
  }),
}));

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthorization).mockReturnValue({
      can: () => true,
      isTenant: false,
      role: 'property_owner',
    } as any);

    vi.mocked(apiFetch).mockImplementation((url: string) => {
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
    });
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

  it('allows tenant to open Midtrans Snap popup for unpaid bill and handles onSuccess callback', async () => {
    vi.mocked(useAuthorization).mockReturnValue({
      can: () => false,
      isTenant: true,
      role: 'tenant',
    } as any);

    const mockSnapPay = vi.fn((_token: string, callbacks?: any) => {
      if (callbacks?.onSuccess) {
        callbacks.onSuccess({
          order_id: 'LK-pay00200-1794666600',
          transaction_id: 'midtrans-tx-999',
          transaction_status: 'settlement',
          payment_type: 'qris',
          gross_amount: '1650000.00',
        });
      }
    });
    window.snap = { pay: mockSnapPay };

    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url.includes('/snap-token')) {
        return Promise.resolve({
          token: 'snap-test-token-xyz',
          redirect_url: 'https://app.sandbox.midtrans.com/snap/v4/redirection/snap-test-token-xyz',
          order_id: 'LK-pay00200-1794666600',
          client_key: 'SB-Mid-client-test',
        });
      }
      if (url.includes('/snap-callback')) {
        return Promise.resolve({
          status: 'synced',
          is_duplicate: false,
          payment_status: 'paid',
          payment: {
            id: 'pay-002',
            property_id: 'prop-001',
            contract_id: 'ctr-001',
            period_month: 11,
            period_year: 2026,
            amount_rent: 1500000,
            amount_electricity: 100000,
            amount_water: 50000,
            amount_other: 0,
            total_paid: 1650000,
            amount_minor: 1650000,
            paid_amount_minor: 1650000,
            currency: 'IDR',
            status: 'paid',
            due_date: '2026-11-05',
            payment_method: 'qris',
          },
        });
      }
      if (url.includes('/receipt-data')) {
        return Promise.resolve({
          id: 'rc-001',
          receipt_number: 'INV/2026/11/PAY002',
          checksum: 'sha256-valid-checksum',
        });
      }
      return Promise.resolve([
        {
          id: 'pay-002',
          property_id: 'prop-001',
          contract_id: 'ctr-001',
          period_month: 11,
          period_year: 2026,
          amount_rent: 1500000,
          amount_electricity: 100000,
          amount_water: 50000,
          amount_other: 0,
          total_paid: 0,
          amount_minor: 1650000,
          paid_amount_minor: 0,
          currency: 'IDR',
          status: 'unpaid',
          due_date: '2026-11-05',
          payment_method: '',
        },
      ]);
    });

    render(<PaymentsPage />);

    const payButton = await screen.findByRole('button', { name: /Bayar/i });
    fireEvent.click(payButton);

    expect(await screen.findByText('Bayar Instan Online (Midtrans Sandbox)')).toBeInTheDocument();
    expect(screen.getByText('Transfer Manual & Upload Bukti')).toBeInTheDocument();
    expect(screen.getByText('Virtual Account BCA')).toBeInTheDocument();

    const snapButton = screen.getByRole('button', { name: /Bayar Sekarang via Midtrans/i });
    fireEvent.click(snapButton);

    await waitFor(() => {
      expect(mockSnapPay).toHaveBeenCalledWith('snap-test-token-xyz', expect.any(Object));
    });

    expect(
      await screen.findByText(/Pembayaran via Midtrans berhasil!/i),
    ).toBeInTheDocument();
  });
});
