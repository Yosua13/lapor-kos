import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, getCheckoutStatusBadge, getConditionBadge, getSettlementTypeBadge } from './format';

describe('checkout format utilities', () => {
  it('formats currency correctly in IDR', () => {
    const formatted = formatCurrency(1500000);
    expect(formatted).toContain('1.500.000');
  });

  it('formats valid date string', () => {
    const formatted = formatDate('2026-10-31');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('31');
  });

  it('handles empty date string gracefully', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });

  it('returns appropriate badges for checkout statuses', () => {
    expect(getCheckoutStatusBadge('submitted').label).toBe('Notice Diajukan');
    expect(getCheckoutStatusBadge('approved').label).toBe('Disetujui');
    expect(getCheckoutStatusBadge('completed').label).toBe('Selesai (Closed)');
    expect(getCheckoutStatusBadge('cancelled').label).toBe('Dibatalkan');
  });

  it('returns appropriate badges for asset condition', () => {
    expect(getConditionBadge('good').label).toBe('Baik');
    expect(getConditionBadge('damaged').label).toBe('Rusak');
    expect(getConditionBadge('missing').label).toBe('Hilang');
  });

  it('returns settlement type badges', () => {
    expect(getSettlementTypeBadge('refund').label).toContain('Refund');
    expect(getSettlementTypeBadge('invoice').label).toContain('Tagihan');
    expect(getSettlementTypeBadge('zero_balance').label).toContain('Saldo Pas');
  });
});
