import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoicesPage from './page';
import { listInvoices } from '@/features/invoices/api';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useRouter } from 'next/navigation';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/features/invoices/api', () => ({
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  getBillingPolicy: vi.fn(),
  updateBillingPolicy: vi.fn(),
  generateInvoices: vi.fn(),
  listBillingJobs: vi.fn(),
  previewAdjustment: vi.fn(),
  createAdjustment: vi.fn(),
  recordMeterReading: vi.fn(),
  createFinalSettlement: vi.fn(),
}));

vi.mock('@/features/authorization/useAuthorization', () => ({
  useAuthorization: vi.fn(),
}));

vi.mock('@/features/properties/PropertyProvider', () => ({
  useActiveProperty: vi.fn(),
}));

describe('InvoicesPage', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as any);

    vi.mocked(useActiveProperty).mockReturnValue({
      activeProperty: { id: 'prop-1', name: 'Kos Melati' } as any,
      properties: [],
      isLoading: false,
      error: null,
      scopeVersion: 0,
      switchProperty: vi.fn(),
      refreshProperties: vi.fn(),
    });
  });

  it('renders tenant invoice portal when user is tenant', async () => {
    vi.mocked(useAuthorization).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isTenant: true,
      role: null,
    });

    vi.mocked(listInvoices).mockResolvedValue({
      items: [
        {
          id: 'inv-1',
          property_id: 'prop-1',
          contract_id: 'contract-1',
          tenant_id: 'tenant-1',
          invoice_number: 'INV-202610-001',
          billing_period: '2026-10-01',
          invoice_type: 'recurring',
          status: 'issued',
          currency: 'IDR',
          due_at: '2026-10-15T00:00:00Z',
          total_minor: 1500000,
          allocated_minor: 0,
          credit_applied_minor: 0,
          outstanding_minor: 1500000,
          calculation_snapshot: {},
          tenant_name: 'Budi',
          room_number: 'A-01',
        },
      ],
      page: 1,
      page_size: 10,
      total_items: 1,
      total_pages: 1,
    });

    render(<InvoicesPage />);

    expect(screen.getByText('Invoice & Tagihan Saya')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('INV-202610-001')).toBeInTheDocument();
      expect(screen.getAllByText('Terbit').length).toBeGreaterThan(0);
    });

    // Staff actions must NOT be present
    expect(screen.queryByText('Generate Tagihan')).not.toBeInTheDocument();
    expect(screen.queryByText('Catat Meter')).not.toBeInTheDocument();
  });

  it('renders staff invoices management with action buttons', async () => {
    vi.mocked(useAuthorization).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isTenant: false,
      role: 'property_owner' as any,
    });

    vi.mocked(listInvoices).mockResolvedValue({
      items: [
        {
          id: 'inv-2',
          property_id: 'prop-1',
          contract_id: 'contract-2',
          tenant_id: 'tenant-2',
          invoice_number: 'INV-202610-002',
          billing_period: '2026-10-01',
          invoice_type: 'recurring',
          status: 'paid',
          currency: 'IDR',
          due_at: '2026-10-15T00:00:00Z',
          total_minor: 2000000,
          allocated_minor: 2000000,
          credit_applied_minor: 0,
          outstanding_minor: 0,
          calculation_snapshot: {},
          tenant_name: 'Siti',
          room_number: 'B-02',
        },
      ],
      page: 1,
      page_size: 10,
      total_items: 1,
      total_pages: 1,
    });

    render(<InvoicesPage />);

    expect(screen.getByText('Invoice & Tagihan')).toBeInTheDocument();
    expect(screen.getByText('Generate Tagihan')).toBeInTheDocument();
    expect(screen.getByText('Catat Meter')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('INV-202610-002')).toBeInTheDocument();
      expect(screen.getByText('Siti')).toBeInTheDocument();
      expect(screen.getByText('Kamar B-02')).toBeInTheDocument();
      expect(screen.getAllByText('Lunas').length).toBeGreaterThan(0);
    });
  });
});
