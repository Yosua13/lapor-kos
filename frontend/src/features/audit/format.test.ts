import { describe, expect, it } from 'vitest';
import {
  formatAuditAction,
  formatAuditAmount,
  formatAuditDateTime,
  formatEntityType,
  getHealthBadge,
} from './format';

describe('audit formatting utilities', () => {
  it('formats action labels into human-readable Indonesian terms', () => {
    expect(formatAuditAction('payment_verify')).toBe('Verifikasi Pembayaran');
    expect(formatAuditAction('payment_reject')).toBe('Penolakan Pembayaran');
    expect(formatAuditAction('period_close')).toBe('Tutup Buku Periode');
    expect(formatAuditAction('period_reopen')).toBe('Buka Kembali Buku');
    expect(formatAuditAction('adjustment_approved')).toBe('Persetujuan Penyesuaian');
    expect(formatAuditAction('expense_create')).toBe('Pencatatan Biaya');
  });

  it('formats entity type labels correctly', () => {
    expect(formatEntityType('payment')).toBe('Pembayaran');
    expect(formatEntityType('expense')).toBe('Pengeluaran');
    expect(formatEntityType('period_close')).toBe('Periode Buku');
    expect(formatEntityType('adjustment')).toBe('Penyesuaian');
  });

  it('formats amounts in Indonesian Rupiah with minor unit handling', () => {
    expect(formatAuditAmount(0)).toBe('-');
    expect(formatAuditAmount(1500000)).toContain('1.500.000');
    expect(formatAuditAmount(-500000)).toContain('-Rp');
  });

  it('formats dates cleanly', () => {
    expect(formatAuditDateTime('')).toBe('-');
    const formatted = formatAuditDateTime('2026-10-16T10:30:00Z');
    expect(formatted).toContain('2026');
  });

  it('resolves correct health badge styling and label', () => {
    expect(getHealthBadge('ready').label).toBe('SEHAT (READY)');
    expect(getHealthBadge('ready').className).toContain('emerald');
    expect(getHealthBadge('degraded').label).toBe('DEGRADED');
    expect(getHealthBadge('unhealthy').label).toBe('TIDAK SEHAT (DOWN)');
  });
});
