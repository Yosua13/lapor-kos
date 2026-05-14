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
          label: 'KOSONG',
          classes: 'bg-amber-500/10 text-amber-600'
        };
      case 'occupied':
      case 'terisi':
        return {
          label: 'TERISI',
          classes: 'bg-brand-teal/10 text-brand-teal animate-pulse-teal shadow-[0_0_15px_rgba(20,184,166,0.1)]'
        };
      default:
        return {
          label: status.toUpperCase(),
          classes: 'bg-brand-navy/5 text-brand-navy/40'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-500 ${config.classes}`}>
      {config.label}
    </span>
  );
}
