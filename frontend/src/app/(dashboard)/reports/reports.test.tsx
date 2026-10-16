import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsAndFinancePage from './page';
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
  getFinancialDashboard: vi.fn(),
  getReceivablesAging: vi.fn(),
  listExpenses: vi.fn(),
  createExpense: vi.fn(),
  listPeriodClosures: vi.fn(),
  closePeriod: vi.fn(),
  reopenPeriod: vi.fn(),
  listAdjustments: vi.fn(),
  createAdjustment: vi.fn(),
  approveAdjustment: vi.fn(),
  createExportJob: vi.fn(),
  listExportJobs: vi.fn(),
  downloadExport: vi.fn(),
}));

describe('ReportsAndFinancePage', () => {
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

    vi.mocked(financeApi.getFinancialDashboard).mockResolvedValue({
      property_id: 'prop-101',
      property_name: 'Kos Melati Finance',
      currency: 'IDR',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      is_period_closed: false,
      cash_received_minor: 12500000,
      pending_payments_minor: 1500000,
      deposit_liability_minor: 5000000,
      billed_revenue_minor: 15000000,
      operating_expenses_minor: 2500000,
      net_operating_income_minor: 10000000,
      accrual_net_income_minor: 12500000,
      total_receivable_minor: 2500000,
      receivables_aging: {
        current_minor: 2000000,
        due_31_to_60_minor: 500000,
        due_61_to_90_minor: 0,
        overdue_90_plus_minor: 0,
        total_outstanding_minor: 2500000,
        invoices: [],
      },
      expenses_by_category: [
        {
          category: 'utilities',
          category_label: 'Listrik, Air & WiFi',
          total_minor: 1500000,
          count: 2,
          percentage: 60,
        },
      ],
      occupancy_stats: {
        total_rooms: 10,
        occupied_rooms: 8,
        available_rooms: 2,
        occupancy_rate: 80,
        potential_monthly_revenue_minor: 15000000,
        actual_monthly_revenue_minor: 12000000,
      },
    });

    vi.mocked(financeApi.getReceivablesAging).mockResolvedValue({
      current_minor: 2000000,
      due_31_to_60_minor: 500000,
      due_61_to_90_minor: 0,
      overdue_90_plus_minor: 0,
      total_outstanding_minor: 2500000,
      invoices: [],
    });

    vi.mocked(financeApi.listExpenses).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      page_size: 50,
    });

    vi.mocked(financeApi.listPeriodClosures).mockResolvedValue([]);
    vi.mocked(financeApi.listAdjustments).mockResolvedValue([]);
    vi.mocked(financeApi.listExportJobs).mockResolvedValue([]);
  });

  it('renders reconciliation metrics and distinguishes cash received, deposits, and billed revenue', async () => {
    render(<ReportsAndFinancePage />);

    // Header title
    expect(await screen.findByText('Laporan & Rekonsiliasi Keuangan')).toBeInTheDocument();

    // Check reconciliation cards
    expect(screen.getByText('Kas Masuk Riil (Verified)')).toBeInTheDocument();
    expect(screen.getByText('Titipan Deposit (Liabilitas)')).toBeInTheDocument();
    expect(screen.getByText('Pendapatan Terbiling (Akrual)')).toBeInTheDocument();
    expect(screen.getByText('Pengeluaran Operasional')).toBeInTheDocument();
    expect(screen.getByText('NOI (Basis Kas)')).toBeInTheDocument();

    // Verification notes
    expect(screen.getByText(/Hanya pembayaran terverifikasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Kewajiban titipan penyewa aktif/i)).toBeInTheDocument();

    // Comparative table
    expect(screen.getByText('Tabel Rekonsiliasi Usaha (Basis Kas vs Akrual)')).toBeInTheDocument();
    expect(screen.getByText('Distribusi Beban Pengeluaran per Kategori')).toBeInTheDocument();
  });

  it('displays closed period indicator when period is closed', async () => {
    vi.mocked(financeApi.getFinancialDashboard).mockResolvedValueOnce({
      property_id: 'prop-101',
      property_name: 'Kos Melati Finance',
      currency: 'IDR',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      is_period_closed: true,
      period_closure: {
        id: 'cls-001',
        property_id: 'prop-101',
        period_key: '2026-10',
        period_start: '2026-10-01',
        period_end: '2026-10-31',
        status: 'closed',
        closed_by: 'usr-001',
        closed_by_name: 'Yosua Reynaldi',
        closed_at: '2026-10-31T23:59:59Z',
        summary_snapshot: {},
        notes: 'Audit final Oktober',
        created_at: '2026-10-31T23:59:59Z',
        updated_at: '2026-10-31T23:59:59Z',
      },
      cash_received_minor: 10000000,
      pending_payments_minor: 0,
      deposit_liability_minor: 5000000,
      billed_revenue_minor: 12000000,
      operating_expenses_minor: 2000000,
      net_operating_income_minor: 8000000,
      accrual_net_income_minor: 10000000,
      total_receivable_minor: 2000000,
      receivables_aging: {
        current_minor: 2000000,
        due_31_to_60_minor: 0,
        due_61_to_90_minor: 0,
        overdue_90_plus_minor: 0,
        total_outstanding_minor: 2000000,
        invoices: [],
      },
      expenses_by_category: [],
      occupancy_stats: {
        total_rooms: 10,
        occupied_rooms: 8,
        available_rooms: 2,
        occupancy_rate: 80,
        potential_monthly_revenue_minor: 15000000,
        actual_monthly_revenue_minor: 12000000,
      },
    });

    render(<ReportsAndFinancePage />);

    expect(await screen.findByText(/Periode Ditutup Buku/i)).toBeInTheDocument();
    expect(screen.getByText(/Ajukan Penyesuaian Audit/i)).toBeInTheDocument();
  });
});
