import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpensesPage from './page';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import * as financeApi from '@/features/finance/api';

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: vi.fn(),
}));

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: vi.fn(),
}));

vi.mock('@/features/finance/api', () => ({
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  approveExpense: vi.fn(),
  payExpense: vi.fn(),
  deleteExpense: vi.fn(),
  getPeriodClosure: vi.fn(),
}));

describe('ExpensesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useActiveProperty).mockReturnValue({
      activeProperty: {
        id: 'prop-101',
        name: 'Kos Melati Finance',
        address: 'Jl. Merdeka',
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        role: 'property_owner',
        status: 'active',
        membership_id: 'mem-101',
      },
      properties: [],
      isLoading: false,
      error: null,
      scopeVersion: 1,
      refreshProperties: vi.fn(),
      switchProperty: vi.fn(),
    });

    vi.mocked(useAuthorization).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isTenant: false,
      role: 'property_owner',
    });

    vi.mocked(financeApi.listExpenses).mockResolvedValue({
      data: [
        {
          id: 'exp-001',
          property_id: 'prop-101',
          expense_number: 'EXP-202610-0001',
          category: 'maintenance',
          vendor_name: 'Toko Abadi',
          title: 'Servis AC Kamar 101',
          description: 'Tambah freon dan cuci AC',
          amount_minor: 250000,
          currency: 'IDR',
          expense_date: '2026-10-10',
          status: 'paid',
          payment_method: 'bank_transfer',
          is_recurring: false,
          created_at: '2026-10-10T10:00:00Z',
          updated_at: '2026-10-10T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 15,
    });
  });

  it('renders expenses header and lists recorded items with vendor and status', async () => {
    render(<ExpensesPage />);

    expect(await screen.findByText('Biaya & Pengeluaran Operasional')).toBeInTheDocument();
    expect(screen.getByText('Servis AC Kamar 101')).toBeInTheDocument();
    expect(screen.getByText('Toko Abadi')).toBeInTheDocument();
    expect(screen.getByText('EXP-202610-0001')).toBeInTheDocument();
    expect(screen.getAllByText('Dibayar').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Catat Pengeluaran/i)).toBeInTheDocument();
  });
});
