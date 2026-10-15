import type { NotificationCategory, OutboxStatus, DeliveryStatus } from './types';

export const getCategoryLabel = (category: NotificationCategory): string => {
  switch (category) {
    case 'billing':
      return 'Keuangan & Tagihan';
    case 'operations':
      return 'Operasional & Kamar';
    case 'complaint':
      return 'Komplain';
    case 'contract':
      return 'Kontrak';
    case 'announcement':
      return 'Pengumuman';
    case 'security':
      return 'Keamanan';
    default:
      return 'Umum';
  }
};

export const getCategoryBadgeStyle = (category: NotificationCategory): { bg: string; text: string; border: string } => {
  switch (category) {
    case 'billing':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'operations':
      return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
    case 'complaint':
      return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'contract':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
    case 'announcement':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'security':
      return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
    default:
      return { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
  }
};

export const getOutboxStatusLabel = (status: OutboxStatus): string => {
  switch (status) {
    case 'delivered':
      return 'Terkirim';
    case 'failed':
      return 'Gagal';
    case 'pending':
      return 'Menunggu';
    case 'processing':
      return 'Memproses';
    case 'partially_delivered':
      return 'Sebagian Terkirim';
    case 'skipped':
      return 'Dilewati';
    case 'deduplicated':
      return 'Duplikat (Diabaikan)';
    default:
      return status;
  }
};

export const getOutboxStatusBadge = (status: OutboxStatus): { bg: string; text: string } => {
  switch (status) {
    case 'delivered':
      return { bg: 'bg-emerald-100', text: 'text-emerald-800' };
    case 'failed':
      return { bg: 'bg-red-100', text: 'text-red-800' };
    case 'pending':
    case 'processing':
      return { bg: 'bg-amber-100', text: 'text-amber-800' };
    case 'partially_delivered':
      return { bg: 'bg-cyan-100', text: 'text-cyan-800' };
    case 'skipped':
    case 'deduplicated':
      return { bg: 'bg-gray-100', text: 'text-gray-800' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800' };
  }
};

export const getDeliveryStatusLabel = (status: DeliveryStatus): string => {
  switch (status) {
    case 'delivered':
      return 'Terkirim';
    case 'failed':
      return 'Gagal';
    case 'pending':
      return 'Menunggu';
    case 'skipped_quiet_hours':
      return 'Jam Tenang';
    case 'opted_out':
      return 'Opt-out';
    case 'deduplicated':
      return 'Duplikat';
    default:
      return status;
  }
};

export const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  if (diffSec < 172800) return 'Kemarin';
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};
