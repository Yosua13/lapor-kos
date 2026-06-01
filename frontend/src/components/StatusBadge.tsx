import React from 'react';

type StatusType = 'available' | 'occupied' | 'active' | 'expired' | 'paid' | 'unpaid' | 'overdue' | 'partial' | 'expiring' | 'vacant';

interface StatusBadgeProps {
  status: string;
  customLabel?: string;
}

const statusMap: Record<StatusType, { label: string; classes: string }> = {
  active:   { label: 'Aktif',        classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  available:{ label: 'Kosong',       classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  vacant:   { label: 'Kosong',       classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  occupied: { label: 'Terisi',       classes: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' },
  paid:     { label: 'Lunas',        classes: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  unpaid:   { label: 'Belum Bayar',  classes: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  overdue:  { label: 'Terlambat',    classes: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  partial:  { label: 'Sebagian',     classes: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  expiring: { label: 'Segera Habis', classes: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' },
  expired:  { label: 'Berakhir',     classes: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' },
};

export default function StatusBadge({ status, customLabel }: StatusBadgeProps) {
  const key = status.toLowerCase() as StatusType;
  const config = statusMap[key] || {
    label: status.toUpperCase(),
    classes: 'bg-brand-navy/5 text-brand-navy/50 ring-1 ring-brand-navy/10',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${config.classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        key === 'active' || key === 'paid' ? 'bg-emerald-500' :
        key === 'occupied' ? 'bg-teal-500' :
        key === 'available' || key === 'vacant' || key === 'partial' ? 'bg-amber-500' :
        key === 'unpaid' || key === 'overdue' || key === 'expired' ? 'bg-red-500' :
        key === 'expiring' ? 'bg-orange-500' :
        'bg-gray-400'
      }`} />
      {customLabel || config.label}
    </span>
  );
}
