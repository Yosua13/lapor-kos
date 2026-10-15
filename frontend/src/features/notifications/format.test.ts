import { describe, expect, it } from 'vitest';
import {
  getCategoryLabel,
  getCategoryBadgeStyle,
  getOutboxStatusLabel,
  getDeliveryStatusLabel,
  formatRelativeTime,
} from './format';

describe('Notification Format Utilities', () => {
  it('maps category to Indonesian label', () => {
    expect(getCategoryLabel('billing')).toBe('Keuangan & Tagihan');
    expect(getCategoryLabel('operations')).toBe('Operasional & Kamar');
    expect(getCategoryLabel('complaint')).toBe('Komplain');
    expect(getCategoryLabel('contract')).toBe('Kontrak');
    expect(getCategoryLabel('announcement')).toBe('Pengumuman');
    expect(getCategoryLabel('security')).toBe('Keamanan');
    expect(getCategoryLabel('general')).toBe('Umum');
  });

  it('provides category badge styling', () => {
    const style = getCategoryBadgeStyle('billing');
    expect(style.bg).toBe('bg-emerald-50');
    expect(style.text).toBe('text-emerald-700');
  });

  it('maps outbox statuses correctly', () => {
    expect(getOutboxStatusLabel('delivered')).toBe('Terkirim');
    expect(getOutboxStatusLabel('failed')).toBe('Gagal');
    expect(getOutboxStatusLabel('pending')).toBe('Menunggu');
    expect(getOutboxStatusLabel('deduplicated')).toBe('Duplikat (Diabaikan)');
  });

  it('maps delivery statuses correctly', () => {
    expect(getDeliveryStatusLabel('skipped_quiet_hours')).toBe('Jam Tenang');
    expect(getDeliveryStatusLabel('opted_out')).toBe('Opt-out');
  });

  it('formats relative time', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('Baru saja');

    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(formatRelativeTime(tenMinAgo.toISOString())).toBe('10 menit lalu');

    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe('2 jam lalu');
  });
});
