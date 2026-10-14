import type { PaymentStatus, RefundStatus } from './types';

export const formatMoney = (value: number | string | undefined | null, currency = 'IDR'): string => {
  if (value === undefined || value === null) return 'Rp 0';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]/g, '')) || 0 : value;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
};

export const formatPeriod = (month: number, year: number): string => {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const monthName = months[month - 1] || `Bulan ${month}`;
  return `${monthName} ${year}`;
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  unpaid: 'Belum Bayar',
  pending: 'Menunggu Verifikasi',
  paid: 'Lunas',
  partial: 'Dibayar Sebagian',
  overdue: 'Terlambat',
  rejected: 'Ditolak',
  refunded: 'Dikembalikan (Refund)',
  void: 'Dibatalkan',
};

export const paymentStatusTone: Record<PaymentStatus, string> = {
  unpaid: 'bg-rose-50 text-rose-700 border-rose-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-sky-50 text-sky-700 border-sky-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-slate-100 text-slate-700 border-slate-300',
  refunded: 'bg-purple-50 text-purple-700 border-purple-200',
  void: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const refundStatusLabel: Record<RefundStatus, string> = {
  requested: 'Diajukan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  disbursed: 'Telah Dicairkan',
};

export const refundStatusTone: Record<RefundStatus, string> = {
  requested: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-sky-50 text-sky-700 border-sky-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  disbursed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
