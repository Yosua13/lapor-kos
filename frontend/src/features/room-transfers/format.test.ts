import { describe, it, expect } from 'vitest';
import { formatMinorMoney, formatDateDisplay, getTransferStatusBadge } from './format';

describe('formatMinorMoney', () => {
  it('formats positive IDR amounts properly', () => {
    expect(formatMinorMoney(1500000)).toBe('Rp 1.500.000');
    expect(formatMinorMoney(0)).toBe('Rp 0');
  });

  it('formats negative IDR amounts with negative sign', () => {
    expect(formatMinorMoney(-250000)).toBe('-Rp 250.000');
  });

  it('formats non-IDR currencies', () => {
    expect(formatMinorMoney(50, 'USD')).toBe('USD 50');
  });
});

describe('formatDateDisplay', () => {
  it('formats ISO dates in Indonesian locale', () => {
    const formatted = formatDateDisplay('2026-10-15');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2026');
  });

  it('handles empty or dash', () => {
    expect(formatDateDisplay('')).toBe('-');
  });
});

describe('getTransferStatusBadge', () => {
  it('returns badge for pending', () => {
    const badge = getTransferStatusBadge('pending');
    expect(badge.label).toBe('Menunggu Persetujuan');
    expect(badge.text).toBe('text-amber-700');
  });

  it('returns badge for completed', () => {
    const badge = getTransferStatusBadge('completed');
    expect(badge.label).toBe('Selesai Dipindahkan');
    expect(badge.text).toBe('text-emerald-700');
  });

  it('returns badge for rejected', () => {
    const badge = getTransferStatusBadge('rejected');
    expect(badge.label).toBe('Ditolak');
  });
});
