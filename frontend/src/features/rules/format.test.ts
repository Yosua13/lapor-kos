import { describe, it, expect } from 'vitest';
import {
  getCategoryLabel,
  getCategoryColor,
  getSeverityBadge,
  getVersionStatusBadge,
  formatDate,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  VERSION_STATUS_LABELS,
} from './format';

describe('rules format helpers', () => {
  it('maps category labels accurately', () => {
    expect(getCategoryLabel('keamanan')).toBe('Keamanan & Akses');
    expect(getCategoryLabel('kebersihan')).toBe('Kebersihan');
    expect(getCategoryLabel('fasilitas')).toBe('Fasilitas & Energi');
    expect(getCategoryLabel('pembayaran')).toBe('Keuangan & Pembayaran');
    expect(getCategoryLabel('ketertiban')).toBe('Ketertiban Lingkungan');
    expect(getCategoryLabel('tamu')).toBe('Tamu & Kunjungan');
    expect(getCategoryLabel('umum')).toBe('Ketentuan Umum');
    expect(getCategoryLabel('unknown_category')).toBe('unknown_category');
  });

  it('provides category colors', () => {
    expect(getCategoryColor('keamanan')).toContain('blue');
    expect(getCategoryColor('kebersihan')).toContain('emerald');
    expect(getCategoryColor('fasilitas')).toContain('amber');
    expect(getCategoryColor('pembayaran')).toContain('rose');
    expect(getCategoryColor('ketertiban')).toContain('indigo');
    expect(getCategoryColor('tamu')).toContain('purple');
    expect(getCategoryColor('umum')).toContain('teal');
  });

  it('maps severity badges properly', () => {
    const critical = getSeverityBadge('critical');
    expect(critical.label).toBe('Kritis');
    expect(critical.color).toContain('red');

    const major = getSeverityBadge('major');
    expect(major.label).toBe('Penting');
    expect(major.color).toContain('amber');

    const standard = getSeverityBadge('standard');
    expect(standard.label).toBe('Standar');
    expect(standard.color).toContain('sky');

    const minor = getSeverityBadge('minor');
    expect(minor.label).toBe('Ringan');
    expect(minor.color).toContain('slate');
  });

  it('maps version status badges properly', () => {
    const published = getVersionStatusBadge('published');
    expect(published.label).toBe('Aktif / Diterbitkan');
    expect(published.color).toContain('emerald');

    const draft = getVersionStatusBadge('draft');
    expect(draft.label).toBe('Draft');
    expect(draft.color).toContain('amber');

    const superseded = getVersionStatusBadge('superseded');
    expect(superseded.label).toBe('Tergantikan (Histori)');
    expect(superseded.color).toContain('slate');
  });

  it('formats dates cleanly or handles dashes', () => {
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('')).toBe('-');
    expect(formatDate('2026-10-16T12:00:00Z')).toContain('2026');
  });

  it('exports valid label constants', () => {
    expect(Object.keys(CATEGORY_LABELS).length).toBe(7);
    expect(Object.keys(SEVERITY_LABELS).length).toBe(4);
    expect(Object.keys(VERSION_STATUS_LABELS).length).toBe(4);
  });
});
