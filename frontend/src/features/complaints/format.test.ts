import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatDurationMinutes,
  getCategoryLabel,
  getImpactBadge,
  getPriorityBadge,
  getSLABadge,
  getStatusBadge,
  getWorkOrderStatusBadge,
} from './format';

describe('Complaints Format Utilities', () => {
  it('formats priority badges correctly', () => {
    expect(getPriorityBadge('urgent').label).toBe('Darurat / Urgent');
    expect(getPriorityBadge('urgent').color).toContain('text-red');

    expect(getPriorityBadge('high').label).toBe('Tinggi');
    expect(getPriorityBadge('high').color).toContain('text-amber');

    expect(getPriorityBadge('medium').label).toBe('Sedang');
    expect(getPriorityBadge('low').label).toBe('Rendah');
  });

  it('formats impact badges correctly', () => {
    expect(getImpactBadge('emergency').label).toBe('Dampak Kritis');
    expect(getImpactBadge('major').label).toBe('Dampak Mayor');
    expect(getImpactBadge('minor').label).toBe('Dampak Minor');
  });

  it('formats status badges correctly', () => {
    expect(getStatusBadge('pending').label).toBe('Menunggu');
    expect(getStatusBadge('in_progress').label).toBe('Diproses');
    expect(getStatusBadge('scheduled').label).toBe('Terjadwal');
    expect(getStatusBadge('resolved').label).toBe('Selesai (Menunggu Konfirmasi)');
    expect(getStatusBadge('confirmed').label).toBe('Tuntas & Dikonfirmasi');
    expect(getStatusBadge('reopened').label).toBe('Dibuka Kembali');
  });

  it('formats SLA badges correctly', () => {
    expect(getSLABadge('within_sla').label).toBe('Dalam Batas SLA');
    expect(getSLABadge('warning').label).toBe('Mendekati Batas SLA');
    expect(getSLABadge('breached').label).toBe('Melewati Batas SLA (Breached)');
  });

  it('formats work order statuses correctly', () => {
    expect(getWorkOrderStatusBadge('draft').label).toBe('Draf');
    expect(getWorkOrderStatusBadge('assigned').label).toBe('Ditugaskan ke Vendor');
    expect(getWorkOrderStatusBadge('completed').label).toBe('Pekerjaan Selesai');
  });

  it('formats category labels correctly', () => {
    expect(getCategoryLabel('facility')).toBe('Kerusakan Fasilitas');
    expect(getCategoryLabel('noisy')).toBe('Keributan / Gangguan Suara');
    expect(getCategoryLabel('cleanliness')).toBe('Kebersihan');
    expect(getCategoryLabel('security')).toBe('Keamanan');
    expect(getCategoryLabel('other')).toBe('Lainnya');
  });

  it('formats duration in minutes correctly', () => {
    expect(formatDurationMinutes(30)).toBe('30m');
    expect(formatDurationMinutes(90)).toBe('1j 30m');
    expect(formatDurationMinutes(120)).toBe('2j');
    expect(formatDurationMinutes(1500)).toBe('1h 1j');
    expect(formatDurationMinutes(-10)).toBe('-');
    expect(formatDurationMinutes(undefined)).toBe('-');
  });

  it('formats currency correctly', () => {
    const formatted = formatCurrency(250000);
    expect(formatted).toContain('250.000');
    expect(formatCurrency(0)).toContain('0');
  });
});
