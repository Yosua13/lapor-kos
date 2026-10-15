import type { RuleCategory, RuleSeverity, RuleVersionStatus } from './types';

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  keamanan: 'Keamanan & Akses',
  kebersihan: 'Kebersihan',
  fasilitas: 'Fasilitas & Energi',
  pembayaran: 'Keuangan & Pembayaran',
  ketertiban: 'Ketertiban Lingkungan',
  tamu: 'Tamu & Kunjungan',
  umum: 'Ketentuan Umum',
};

export const SEVERITY_LABELS: Record<RuleSeverity, string> = {
  critical: 'Kritis',
  major: 'Penting',
  standard: 'Standar',
  minor: 'Ringan',
};

export const VERSION_STATUS_LABELS: Record<RuleVersionStatus, string> = {
  draft: 'Draft',
  published: 'Aktif / Berlaku',
  superseded: 'Tergantikan (Histori)',
  archived: 'Diarsipkan',
};

export const getCategoryLabel = (category: string): string => {
  return CATEGORY_LABELS[category as RuleCategory] || category;
};

export const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'keamanan':
      return 'text-blue-700 bg-blue-50 border-blue-200';
    case 'kebersihan':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'fasilitas':
      return 'text-amber-700 bg-amber-50 border-amber-200';
    case 'pembayaran':
      return 'text-rose-700 bg-rose-50 border-rose-200';
    case 'ketertiban':
      return 'text-indigo-700 bg-indigo-50 border-indigo-200';
    case 'tamu':
      return 'text-purple-700 bg-purple-50 border-purple-200';
    case 'umum':
    default:
      return 'text-teal-700 bg-teal-50 border-teal-200';
  }
};

export const getSeverityBadge = (severity: string): { label: string; color: string } => {
  switch (severity) {
    case 'critical':
      return {
        label: 'Kritis',
        color: 'bg-red-100 text-red-800 border-red-300',
      };
    case 'major':
      return {
        label: 'Penting',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'standard':
      return {
        label: 'Standar',
        color: 'bg-sky-100 text-sky-800 border-sky-300',
      };
    case 'minor':
    default:
      return {
        label: 'Ringan',
        color: 'bg-slate-100 text-slate-700 border-slate-300',
      };
  }
};

export const getVersionStatusBadge = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'published':
      return {
        label: 'Aktif / Diterbitkan',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      };
    case 'draft':
      return {
        label: 'Draft',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
      };
    case 'superseded':
      return {
        label: 'Tergantikan (Histori)',
        color: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case 'archived':
    default:
      return {
        label: 'Arsip',
        color: 'bg-gray-100 text-gray-700 border-gray-300',
      };
  }
};

export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return dateStr;
  }
};
