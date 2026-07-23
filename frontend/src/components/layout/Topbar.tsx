'use client';

import Link from 'next/link';
import { Bell, Menu, Settings } from 'lucide-react';
import { PropertySwitcher } from '@/features/properties/components/PropertySwitcher';
import type { SessionUser } from '@/features/session/types';

export function Topbar({ user, isTenant, onOpenMenu }: { user: SessionUser; isTenant: boolean; onOpenMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex h-20 shrink-0 items-center justify-between border-b border-brand-navy/5 bg-white/80 px-4 backdrop-blur-md sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onOpenMenu} className="rounded-lg p-2 text-brand-navy lg:hidden" aria-label="Buka menu">
          <Menu className="h-6 w-6" />
        </button>
        {!isTenant && <div className="hidden min-w-0 sm:block"><PropertySwitcher /></div>}
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button type="button" aria-label="Notifikasi" className="rounded-xl p-2.5 text-brand-navy/40 transition-colors hover:bg-brand-teal/5 hover:text-brand-teal"><Bell className="h-5 w-5" /></button>
        <Link href="/settings" aria-label="Pengaturan" className="rounded-xl p-2.5 text-brand-navy/40 transition-colors hover:bg-brand-teal/5 hover:text-brand-teal"><Settings className="h-5 w-5" /></Link>
        <div className="mx-1 h-6 w-px bg-brand-navy/10" />
        <Link href="/settings" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal text-sm font-bold text-white shadow-lg shadow-brand-teal/10">
            {user.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-bold text-brand-navy">{user.name}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">{isTenant ? 'Penghuni' : 'Staf properti'}</p>
          </div>
        </Link>
      </div>
    </header>
  );
}

