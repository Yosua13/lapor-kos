import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CheckoutsPage from './page';

vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn().mockImplementation((url: string) => {
    if (url.includes('/api/checkouts')) {
      return Promise.resolve({
        data: {
          items: [
            {
              id: 'cko-001',
              property_id: 'prop-001',
              contract_id: 'ctr-001',
              tenant_id: 'usr-001',
              room_id: 'rm-101',
              status: 'submitted',
              scheduled_checkout_date: '2026-10-31',
              reason: 'Habis masa sewa',
              key_returned: false,
              room_override: false,
              created_at: '2026-10-15T08:00:00Z',
              updated_at: '2026-10-15T08:00:00Z',
              tenant_name: 'Budi Santoso',
              room_number: '101',
              settlement: {
                id: 'set-001',
                property_id: 'prop-001',
                checkout_id: 'cko-001',
                currency: 'IDR',
                deposit_held_minor: 1500000,
                unpaid_invoices_minor: 0,
                damage_charges_minor: 0,
                utility_charges_minor: 0,
                credit_balance_minor: 0,
                other_charges_minor: 0,
                net_settlement_minor: 1500000,
                settlement_type: 'refund',
                deposit_status: 'refund_requested',
                created_at: '2026-10-15T08:00:00Z',
                updated_at: '2026-10-15T08:00:00Z',
              },
            },
          ],
          page: 1,
          page_size: 20,
          total_items: 1,
          total_pages: 1,
        },
      });
    }
    return Promise.resolve({ data: [] });
  }),
}));

describe('CheckoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders checkouts dashboard header and item details', async () => {
    render(<CheckoutsPage />);
    expect(await screen.findByText(/Checkout, Inspeksi & Settlement/i)).toBeInTheDocument();
    expect(await screen.findByText('Kamar 101')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByText('Habis masa sewa')).toBeInTheDocument();
    expect(screen.getByText('Notice Diajukan')).toBeInTheDocument();
    expect(screen.getByText('Inspeksi')).toBeInTheDocument();
    expect(screen.getByText('Settlement')).toBeInTheDocument();
  });
});
