'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { CheckoutList } from '@/features/checkouts/components/CheckoutList';

export default function CheckoutsPage() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/tenants"
            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-brand-navy dark:text-white flex items-center gap-2.5">
              <LogOut className="w-6 h-6 text-amber-600" />
              Checkout, Inspeksi & Settlement
            </h1>
            <p className="text-[13px] text-gray-500 dark:text-slate-400">
              Alur terintegrasi checkout penghuni, inspeksi checklist kamar, serah terima kunci, dan settlement deposit
            </p>
          </div>
        </div>
      </div>

      {/* Main List Component */}
      <CheckoutList />
    </div>
  );
}
