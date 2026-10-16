import { describe, expect, it } from 'vitest';
import {
  formatAgingBucket,
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
  formatPeriodStatus,
  formatReportTypeName,
} from './format';

describe('finance formatters', () => {
  it('formats currency correctly in IDR', () => {
    expect(formatCurrency(1500000)).toContain('1.500.000');
    expect(formatCurrency(0)).toContain('0');
    expect(formatCurrency(null)).toContain('0');
  });

  it('formats expense categories with proper Indonesian labels', () => {
    expect(formatExpenseCategory('maintenance').label).toBe('Perawatan & Servis');
    expect(formatExpenseCategory('utilities').label).toBe('Listrik, Air & WiFi');
    expect(formatExpenseCategory('cleaning').label).toBe('Kebersihan & Sampah');
    expect(formatExpenseCategory('supplies').label).toBe('Perlengkapan Kos');
    expect(formatExpenseCategory('operational').label).toBe('Operasional Umum');
    expect(formatExpenseCategory('tax_legal').label).toBe('Pajak & Legalitas');
  });

  it('formats expense statuses accurately', () => {
    expect(formatExpenseStatus('approved').label).toBe('Disetujui');
    expect(formatExpenseStatus('paid').label).toBe('Dibayar');
    expect(formatExpenseStatus('pending_approval').label).toBe('Menunggu Persetujuan');
    expect(formatExpenseStatus('rejected').label).toBe('Ditolak');
    expect(formatExpenseStatus('draft').label).toBe('Draf');
  });

  it('formats period closure statuses accurately', () => {
    expect(formatPeriodStatus('closed').label).toContain('Periode Ditutup');
    expect(formatPeriodStatus('locked').label).toContain('Terkunci Permanen');
    expect(formatPeriodStatus('reopened').label).toContain('Dibuka Kembali');
  });

  it('formats aging buckets accurately', () => {
    expect(formatAgingBucket('current').label).toBe('Lancar');
    expect(formatAgingBucket('31_60').label).toBe('31 - 60 Hari');
    expect(formatAgingBucket('61_90').label).toBe('61 - 90 Hari');
    expect(formatAgingBucket('90_plus').label).toContain('Macet');
  });

  it('formats report type names into human friendly text', () => {
    expect(formatReportTypeName('cash_flow')).toBe('Laporan Arus Kas (Cash Flow)');
    expect(formatReportTypeName('receivables_aging')).toBe('Laporan Umur Piutang (Aging Receivables)');
    expect(formatReportTypeName('expense_summary')).toBe('Ringkasan Beban & Pengeluaran (Expense Summary)');
  });
});
