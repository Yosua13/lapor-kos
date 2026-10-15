import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  paymentStatusLabel,
  paymentStatusTone,
} from './format';

describe('Payment Format Utilities', () => {
  it('formats Indonesian Rupiah amounts consistently', () => {
    expect(formatMoney(1500000)).toContain('1.500.000');
    expect(formatMoney(0)).toContain('0');
    expect(formatMoney(null)).toBe('Rp 0');
  });

  it('formats month and year periods into Indonesian names', () => {
    expect(formatPeriod(10, 2026)).toBe('Oktober 2026');
    expect(formatPeriod(1, 2027)).toBe('Januari 2027');
  });

  it('formats dates properly', () => {
    const d = formatDate('2026-10-14T10:00:00Z');
    expect(d).toContain('2026');
    expect(formatDate(null)).toBe('-');
  });

  it('has valid labels and tones for all payment statuses', () => {
    expect(paymentStatusLabel.paid).toBe('Lunas');
    expect(paymentStatusLabel.partial).toBe('Dibayar Sebagian');
    expect(paymentStatusLabel.pending).toBe('Menunggu Verifikasi');
    expect(paymentStatusTone.paid).toContain('emerald');
  });
});
