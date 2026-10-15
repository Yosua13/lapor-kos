'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { RoomTransferList } from '@/features/room-transfers/components/RoomTransferList';

export default function RoomTransfersPage() {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/rooms"
            className="p-2 text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display font-extrabold text-[22px] text-brand-navy flex items-center gap-2.5">
              <ArrowRightLeft className="w-6 h-6 text-[#0e8a7a]" />
              Manajemen Pindah Kamar
            </h1>
            <p className="text-[13px] text-gray-500">
              Kelola permintaan, persetujuan, dan eksekusi perpindahan kamar penghuni
            </p>
          </div>
        </div>
      </div>

      {/* Transfers List */}
      <RoomTransferList />
    </div>
  );
}
