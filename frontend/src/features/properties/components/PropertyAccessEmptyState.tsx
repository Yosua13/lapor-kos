'use client';

import Link from 'next/link';
import { Building2, RefreshCw } from 'lucide-react';
import { useActiveProperty } from '../PropertyProvider';
import { useSession } from '@/features/session/SessionProvider';

export function PropertyAccessEmptyState() {
  const { refreshProperties } = useActiveProperty();
  const { user } = useSession();
  const canCreate = user?.role === 'owner';

  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-[28px] border border-brand-navy/10 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
          <Building2 className="h-7 w-7" />
        </div>
        <h1 className="font-display text-2xl font-bold text-brand-navy">Belum ada akses properti</h1>
        <p className="mt-2 text-sm leading-6 text-brand-navy/55">
          {canCreate
            ? 'Buat properti pertama untuk mulai mengelola kamar, penghuni, pembayaran, dan operasional.'
            : 'Minta owner menambahkan akun Anda sebagai anggota properti yang aktif.'}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {canCreate && (
            <Link href="/properties" className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-teal/15">
              Buat properti
            </Link>
          )}
          <button
            type="button"
            onClick={() => void refreshProperties()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-navy/10 px-5 py-3 text-sm font-bold text-brand-navy"
          >
            <RefreshCw className="h-4 w-4" /> Muat ulang
          </button>
        </div>
      </div>
    </div>
  );
}

