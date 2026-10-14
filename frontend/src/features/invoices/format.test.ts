import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatPeriod, invoiceStatusLabel, invoiceStatusTone, itemTypeLabel } from './format';

describe('invoice formatting', () => {
  it('formats IDR minor units without floating point decimals', () => {
    expect(formatMoney(1250000, 'IDR')).toContain('1.250.000');
    expect(formatMoney(0, 'IDR')).toContain('0');
  });

  it('provides user-facing invoice status labels', () => {
    expect(invoiceStatusLabel.partially_paid).toBe('Dibayar sebagian');
    expect(invoiceStatusLabel.issued).toBe('Terbit');
    expect(invoiceStatusLabel.paid).toBe('Lunas');
  });

  it('provides status tone styling classes', () => {
    expect(invoiceStatusTone.paid).toContain('emerald');
    expect(invoiceStatusTone.overdue).toContain('rose');
  });

  it('formats dates and periods safely', () => {
    expect(formatDate('2026-10-15T00:00:00Z')).toBe('15 Okt 2026');
    expect(formatDate(null)).toBe('-');
    expect(formatPeriod('2026-10-01')).toContain('2026');
  });

  it('provides item type descriptions', () => {
    expect(itemTypeLabel.rent).toBe('Sewa kamar');
    expect(itemTypeLabel.utility_meter).toBe('Meteran utility');
    expect(itemTypeLabel.adjustment).toBe('Penyesuaian');
  });
});
