import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'available':
      case 'tersedia':
        return {
          label: 'Tersedia',
          classes: 'bg-emerald-50 text-emerald-600 border-emerald-100'
        };
      case 'occupied':
      case 'terisi':
        return {
          label: 'Terisi',
          classes: 'bg-orange-50 text-orange-600 border-orange-100'
        };
      default:
        return {
          label: status,
          classes: 'bg-gray-50 text-gray-600 border-gray-100'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${config.classes}`}>
      {config.label}
    </span>
  );
}
