import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDateTime, formatVehicle, getVisitorStatusBadge } from './format';

describe('guest-permits format utilities', () => {
  it('returns appropriate badge for all statuses', () => {
    expect(getVisitorStatusBadge('pending').label).toBe('Menunggu Persetujuan');
    expect(getVisitorStatusBadge('approved').label).toBe('Disetujui');
    expect(getVisitorStatusBadge('active', false).label).toBe('Tamu di Lokasi (Aktif)');
    expect(getVisitorStatusBadge('active', true).label).toBe('Overstay di Lokasi');
    expect(getVisitorStatusBadge('completed').label).toBe('Selesai (Checked Out)');
    expect(getVisitorStatusBadge('rejected').label).toBe('Ditolak');
    expect(getVisitorStatusBadge('change_requested').label).toBe('Perlu Revisi');
    expect(getVisitorStatusBadge('cancelled').label).toBe('Dibatalkan');
  });

  it('formats vehicle description correctly', () => {
    expect(formatVehicle('tidak_ada')).toBe('Tanpa Kendaraan');
    expect(formatVehicle(undefined)).toBe('Tanpa Kendaraan');
    expect(formatVehicle('motor', 'B 1234 CD')).toBe('Sepeda Motor (B 1234 CD)');
    expect(formatVehicle('mobil', 'D 5678 EF')).toBe('Mobil (D 5678 EF)');
  });

  it('formats date and date range safely', () => {
    expect(formatDateTime(null)).toBe('-');
    expect(formatDateRange(undefined, undefined)).toBe('-');
  });
});
