import type { ExpenseCategory, ExpenseStatus } from './types';

export const formatCurrency = (amountMinor: number | null | undefined): string => {
  const val = amountMinor ?? 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
};

export const formatExpenseCategory = (
  category: ExpenseCategory | string,
): { label: string; color: string; badgeBg: string; badgeText: string } => {
  switch (category) {
    case 'maintenance':
      return {
        label: 'Perawatan & Servis',
        color: '#f59e0b',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700 border-amber-200',
      };
    case 'utilities':
      return {
        label: 'Listrik, Air & WiFi',
        color: '#0284c7',
        badgeBg: 'bg-sky-50',
        badgeText: 'text-sky-700 border-sky-200',
      };
    case 'cleaning':
      return {
        label: 'Kebersihan & Sampah',
        color: '#10b981',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700 border-emerald-200',
      };
    case 'supplies':
      return {
        label: 'Perlengkapan Kos',
        color: '#8b5cf6',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-700 border-purple-200',
      };
    case 'operational':
      return {
        label: 'Operasional Umum',
        color: '#0d9488',
        badgeBg: 'bg-teal-50',
        badgeText: 'text-teal-700 border-teal-200',
      };
    case 'tax_legal':
      return {
        label: 'Pajak & Legalitas',
        color: '#64748b',
        badgeBg: 'bg-slate-50',
        badgeText: 'text-slate-700 border-slate-200',
      };
    case 'marketing':
      return {
        label: 'Pemasaran & Iklan',
        color: '#ec4899',
        badgeBg: 'bg-pink-50',
        badgeText: 'text-pink-700 border-pink-200',
      };
    case 'staff_salary':
      return {
        label: 'Gaji & Upah Staff',
        color: '#6366f1',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700 border-indigo-200',
      };
    default:
      return {
        label: 'Lain-lain',
        color: '#94a3b8',
        badgeBg: 'bg-gray-50',
        badgeText: 'text-gray-700 border-gray-200',
      };
  }
};

export const formatExpenseStatus = (
  status: ExpenseStatus | string,
): { label: string; bg: string; text: string; border: string } => {
  switch (status) {
    case 'approved':
      return { label: 'Disetujui', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'paid':
      return { label: 'Dibayar', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'pending_approval':
      return { label: 'Menunggu Persetujuan', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'rejected':
      return { label: 'Ditolak', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    case 'draft':
      return { label: 'Draf', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' };
    case 'cancelled':
      return { label: 'Dibatalkan', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
    default:
      return { label: status, bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
};

export const formatPeriodStatus = (
  status: string,
): { label: string; bg: string; text: string; badge: string } => {
  switch (status) {
    case 'closed':
      return {
        label: 'Periode Ditutup (Closed)',
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        badge: 'border-amber-200 bg-amber-50 text-amber-700',
      };
    case 'locked':
      return {
        label: 'Terkunci Permanen (Locked)',
        bg: 'bg-purple-50',
        text: 'text-purple-800',
        badge: 'border-purple-200 bg-purple-50 text-purple-700',
      };
    case 'reopened':
      return {
        label: 'Dibuka Kembali (Reopened)',
        bg: 'bg-sky-50',
        text: 'text-sky-800',
        badge: 'border-sky-200 bg-sky-50 text-sky-700',
      };
    default:
      return {
        label: 'Aktif Terbuka',
        bg: 'bg-emerald-50',
        text: 'text-emerald-800',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
  }
};

export const formatAdjustmentStatus = (
  status: string,
): { label: string; badge: string } => {
  switch (status) {
    case 'approved':
      return { label: 'Disetujui', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'rejected':
      return { label: 'Ditolak', badge: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'pending':
    default:
      return { label: 'Menunggu Approval', badge: 'bg-amber-50 text-amber-700 border-amber-200' };
  }
};

export const formatAgingBucket = (
  bucket: string,
): { label: string; description: string; badge: string } => {
  switch (bucket) {
    case 'current':
      return {
        label: 'Lancar',
        description: '≤ 30 hari jatuh tempo',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case '31_60':
      return {
        label: '31 - 60 Hari',
        description: 'Lewat 1-2 bulan',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case '61_90':
      return {
        label: '61 - 90 Hari',
        description: 'Lewat 2-3 bulan',
        badge: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    case '90_plus':
    default:
      return {
        label: '> 90 Hari (Macet)',
        description: 'Tertunggak > 3 bulan',
        badge: 'bg-rose-50 text-rose-700 border-rose-200',
      };
  }
};

export const formatReportTypeName = (type: string): string => {
  switch (type) {
    case 'cash_flow':
      return 'Laporan Arus Kas (Cash Flow)';
    case 'receivables_aging':
      return 'Laporan Umur Piutang (Aging Receivables)';
    case 'expense_summary':
      return 'Ringkasan Beban & Pengeluaran (Expense Summary)';
    case 'income_statement':
      return 'Laba Rugi Operasional (Income Statement)';
    case 'full_ledger':
      return 'Buku Besar Lengkap (Full Ledger)';
    default:
      return type;
  }
};
