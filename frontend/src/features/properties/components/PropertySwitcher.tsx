'use client';

import Link from 'next/link';
import { Building2, ChevronDown } from 'lucide-react';
import { getRoleLabel } from '@/features/authorization/permissions';
import { useActiveProperty } from '../PropertyProvider';

export function PropertySwitcher({ compact = false }: { compact?: boolean }) {
  const { properties, activeProperty, isLoading, switchProperty } = useActiveProperty();

  if (!properties.length) {
    return (
      <Link
        href="/properties"
        className="inline-flex items-center gap-2 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-2 text-xs font-bold text-brand-teal"
      >
        <Building2 className="h-4 w-4" />
        Tambah properti
      </Link>
    );
  }

  return (
    <div className={`relative ${compact ? 'w-full' : 'min-w-0 sm:min-w-[240px]'}`}>
      <label htmlFor={compact ? 'active-property-mobile' : 'active-property'} className="sr-only">
        Properti aktif
      </label>
      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-teal" />
      <select
        id={compact ? 'active-property-mobile' : 'active-property'}
        value={activeProperty?.id ?? ''}
        onChange={(event) => switchProperty(event.target.value)}
        disabled={isLoading}
        className={`w-full appearance-none rounded-xl border py-2 pl-10 pr-9 text-sm font-bold outline-none transition-colors disabled:cursor-wait disabled:opacity-60 ${
          compact
            ? 'border-white/10 bg-white/5 text-white'
            : 'border-brand-navy/10 bg-white text-brand-navy focus:border-brand-teal'
        }`}
      >
        {properties.map((property) => (
          <option key={property.id} value={property.id} className="text-brand-navy">
            {property.name} · {getRoleLabel(property.role)}
          </option>
        ))}
      </select>
      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${compact ? 'text-white/50' : 'text-brand-navy/40'}`} />
    </div>
  );
}

