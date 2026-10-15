import { RoomTransferStatus } from './types';

export function formatMinorMoney(minor: number, currency: string = 'IDR'): string {
  const prefix = currency === 'IDR' ? 'Rp ' : `${currency} `;
  const isNegative = minor < 0;
  const abs = Math.abs(minor);
  const formatted = abs.toLocaleString('id-ID');
  return isNegative ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

export function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function getTransferStatusBadge(status: RoomTransferStatus): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Menunggu Persetujuan',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
      };
    case 'approved':
      return {
        label: 'Disetujui',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
      };
    case 'completed':
      return {
        label: 'Selesai Dipindahkan',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
      };
    case 'rejected':
      return {
        label: 'Ditolak',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
      };
    default:
      return {
        label: status,
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
      };
  }
}
