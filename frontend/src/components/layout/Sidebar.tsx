'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, User, X } from 'lucide-react';
import type { NavigationSection } from './navigation';
import type { SessionUser } from '@/features/session/types';
import { PropertySwitcher } from '@/features/properties/components/PropertySwitcher';
import { getRoleLabel } from '@/features/authorization/permissions';
import type { MembershipRole } from '@/features/properties/types';

interface SidebarProps {
  navigation: NavigationSection[];
  pathname: string;
  user: SessionUser;
  membershipRole: MembershipRole | null;
  isTenant: boolean;
  mobile?: boolean;
  onClose?: () => void;
  onLogout: () => void;
}

export function Sidebar({ navigation, pathname, user, membershipRole, isTenant, mobile = false, onClose, onLogout }: SidebarProps) {
  return (
    <aside className={`${mobile ? 'flex w-72' : 'hidden w-64 lg:flex'} h-full shrink-0 flex-col bg-[#0F172A] text-white-fixed`}>
      <div className="flex items-center justify-between p-6">
        <Link href="/" onClick={onClose} className="flex items-center gap-3">
          <Image src="/images/icon-lapor-kos.png" alt="Lapor Kos" width={40} height={40} className="rounded-xl" />
          <span className="font-display text-2xl font-bold">Lapor <span className="italic text-brand-teal">Kos</span></span>
        </Link>
        {mobile && <button type="button" onClick={onClose} aria-label="Tutup menu"><X className="h-6 w-6 text-white/50" /></button>}
      </div>

      {!isTenant && <div className="px-4 pb-4"><PropertySwitcher compact /></div>}

      <nav className="no-scrollbar flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {navigation.map((section) => (
          <div key={section.section}>
            <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.2em] text-white-fixed/30">{section.section}</p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active ? 'bg-brand-teal/10 text-brand-teal' : 'text-white-fixed/50 hover:bg-white-fixed/5 hover:text-white-fixed'
                    }`}
                  >
                    <Icon className="h-5 w-5" /> {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white-fixed/5 p-5">
        <Link href="/settings" onClick={onClose} className="mb-4 flex items-center gap-3 px-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white-fixed/10"><User className="h-5 w-5 text-brand-teal" /></div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{user.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-white-fixed/40">{isTenant ? 'Penghuni' : getRoleLabel(membershipRole)}</p>
          </div>
        </Link>
        <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 px-3 py-2 text-sm font-bold text-white-fixed/40 transition-colors hover:text-red-400">
          <LogOut className="h-5 w-5" /> Keluar
        </button>
      </div>
    </aside>
  );
}

