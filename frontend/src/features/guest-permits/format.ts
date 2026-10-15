import type { VisitorPermitStatus } from './types';

export const getVisitorStatusBadge = (
  status: VisitorPermitStatus,
  isOverstay = false,
): { label: string; className: string } => {
  if (status === 'active' && isOverstay) {
    return {
      label: 'Overstay di Lokasi',
      className: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/40 font-bold animate-pulse',
    };
  }

  switch (status) {
    case 'pending':
      return {
        label: 'Menunggu Persetujuan',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      };
    case 'approved':
      return {
        label: 'Disetujui',
        className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      };
    case 'active':
      return {
        label: 'Tamu di Lokasi (Aktif)',
        className: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20 font-medium',
      };
    case 'completed':
      return {
        label: 'Selesai (Checked Out)',
        className: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
      };
    case 'rejected':
      return {
        label: 'Ditolak',
        className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
      };
    case 'change_requested':
      return {
        label: 'Perlu Revisi',
        className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
      };
    case 'cancelled':
      return {
        label: 'Dibatalkan',
        className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
      };
    case 'expired':
      return {
        label: 'Kedaluwarsa',
        className: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
      };
    default:
      return {
        label: status,
        className: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      };
  }
};

export const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const formatDateRange = (startStr?: string, endStr?: string, isOvernight = false): string => {
  if (!startStr || !endStr) return '-';
  const start = new Date(startStr);
  const end = new Date(endStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return `${startStr} s/d ${endStr}`;
  }

  const startFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(start);

  const endFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(end);

  const badge = isOvernight ? ' (Menginap)' : ' (Kunjungan Hari Ini)';
  return `${startFormatted} – ${endFormatted}${badge}`;
};

export const formatVehicle = (vehicleType?: string, vehicleNumber?: string): string => {
  if (!vehicleType || vehicleType === 'tidak_ada') {
    return 'Tanpa Kendaraan';
  }
  const typeMap: Record<string, string> = {
    motor: 'Sepeda Motor',
    mobil: 'Mobil',
    lainnya: 'Kendaraan Lain',
  };
  const label = typeMap[vehicleType] || vehicleType;
  return vehicleNumber ? `${label} (${vehicleNumber})` : label;
};
