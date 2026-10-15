import { ComplaintImpact, ComplaintPriority, ComplaintStatus, SLAStatus, WorkOrderStatus } from './types';

export function getPriorityBadge(priority?: ComplaintPriority | string) {
  switch (priority) {
    case 'urgent':
      return {
        label: 'Darurat / Urgent',
        color: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
        dot: 'bg-red-500',
      };
    case 'high':
      return {
        label: 'Tinggi',
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        dot: 'bg-amber-500',
      };
    case 'medium':
      return {
        label: 'Sedang',
        color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
        dot: 'bg-blue-500',
      };
    case 'low':
      return {
        label: 'Rendah',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
      };
    default:
      return {
        label: priority || 'Sedang',
        color: 'text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
        dot: 'bg-zinc-400',
      };
  }
}

export function getImpactBadge(impact?: ComplaintImpact | string) {
  switch (impact) {
    case 'emergency':
      return {
        label: 'Dampak Kritis',
        color: 'text-red-700 bg-red-100/70 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700',
      };
    case 'major':
      return {
        label: 'Dampak Mayor',
        color: 'text-orange-700 bg-orange-100/70 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700',
      };
    case 'minor':
    default:
      return {
        label: 'Dampak Minor',
        color: 'text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
      };
  }
}

export function getStatusBadge(status?: ComplaintStatus | string) {
  switch (status) {
    case 'pending':
      return {
        label: 'Menunggu',
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      };
    case 'in_progress':
    case 'processed':
      return {
        label: 'Diproses',
        color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      };
    case 'scheduled':
      return {
        label: 'Terjadwal',
        color: 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      };
    case 'waiting_vendor':
      return {
        label: 'Menunggu Vendor',
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
      };
    case 'resolved':
      return {
        label: 'Selesai (Menunggu Konfirmasi)',
        color: 'text-teal-700 bg-teal-50 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      };
    case 'confirmed':
      return {
        label: 'Tuntas & Dikonfirmasi',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'reopened':
      return {
        label: 'Dibuka Kembali',
        color: 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        color: 'text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
      };
    default:
      return {
        label: status || 'Pending',
        color: 'text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      };
  }
}

export function getSLABadge(slaStatus?: SLAStatus | string) {
  switch (slaStatus) {
    case 'within_sla':
      return {
        label: 'Dalam Batas SLA',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'warning':
      return {
        label: 'Mendekati Batas SLA',
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      };
    case 'breached':
      return {
        label: 'Melewati Batas SLA (Breached)',
        color: 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
      };
    default:
      return {
        label: 'SLA Normal',
        color: 'text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      };
  }
}

export function getWorkOrderStatusBadge(status?: WorkOrderStatus | string) {
  switch (status) {
    case 'draft':
      return {
        label: 'Draf',
        color: 'text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
      };
    case 'assigned':
      return {
        label: 'Ditugaskan ke Vendor',
        color: 'text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      };
    case 'scheduled':
      return {
        label: 'Kunjungan Terjadwal',
        color: 'text-purple-700 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      };
    case 'in_progress':
      return {
        label: 'Sedang Dikerjakan',
        color: 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      };
    case 'completed':
      return {
        label: 'Pekerjaan Selesai',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        color: 'text-zinc-600 bg-zinc-100 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700',
      };
    default:
      return {
        label: status || 'Draf',
        color: 'text-zinc-700 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      };
  }
}

export function getCategoryLabel(category?: string) {
  switch (category) {
    case 'facility':
      return 'Kerusakan Fasilitas';
    case 'cleanliness':
      return 'Kebersihan';
    case 'noisy':
      return 'Keributan / Gangguan Suara';
    case 'security':
      return 'Keamanan';
    case 'other':
    default:
      return 'Lainnya';
  }
}

export function formatDurationMinutes(minutes?: number): string {
  if (minutes === undefined || minutes === null || isNaN(minutes) || minutes < 0) {
    return '-';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}j ${remainingMins}m` : `${hours}j`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}h ${remainingHours}j` : `${days}h`;
}

export function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return 'Rp 0';
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}
