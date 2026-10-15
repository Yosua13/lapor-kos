import type { CheckoutStatus, InspectionCondition, SettlementType } from './types';

export const formatCurrency = (minor: number, currency = 'IDR'): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor);
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const getCheckoutStatusBadge = (status: CheckoutStatus): { label: string; className: string } => {
  switch (status) {
    case 'submitted':
      return {
        label: 'Notice Diajukan',
        className: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
      };
    case 'inspection_scheduled':
      return {
        label: 'Jadwal Inspeksi',
        className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700',
      };
    case 'inspection_completed':
      return {
        label: 'Inspeksi Selesai',
        className: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-700',
      };
    case 'settlement_pending':
      return {
        label: 'Review Settlement',
        className: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700',
      };
    case 'approved':
      return {
        label: 'Disetujui',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
      };
    case 'completed':
      return {
        label: 'Selesai (Closed)',
        className: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700',
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        className: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-700',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
      };
  }
};

export const getConditionBadge = (condition: InspectionCondition): { label: string; className: string } => {
  switch (condition) {
    case 'good':
      return { label: 'Baik', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' };
    case 'fair':
      return { label: 'Wajar / Aus', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' };
    case 'damaged':
      return { label: 'Rusak', className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400' };
    case 'missing':
      return { label: 'Hilang', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' };
    case 'dirty':
      return { label: 'Kotor', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' };
    default:
      return { label: condition, className: 'bg-slate-100 text-slate-800' };
  }
};

export const getSettlementTypeBadge = (type: SettlementType): { label: string; className: string } => {
  switch (type) {
    case 'refund':
      return {
        label: 'Refund Deposit ke Tenant',
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      };
    case 'invoice':
      return {
        label: 'Tagihan Kurang Bayar',
        className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
      };
    case 'zero_balance':
      return {
        label: 'Saldo Pas (Nol)',
        className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
      };
    default:
      return { label: type, className: 'bg-slate-100 text-slate-800' };
  }
};
