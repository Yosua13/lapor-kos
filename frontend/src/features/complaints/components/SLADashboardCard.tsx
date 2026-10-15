'use client';

import React from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Flame, 
  ShieldAlert, 
  TrendingUp, 
  Layers
} from 'lucide-react';
import type { SLADashboardStats } from '../types';
import { formatDurationMinutes } from '../format';

interface SLADashboardCardProps {
  stats: SLADashboardStats | null;
  isLoading?: boolean;
}

export function SLADashboardCard({ stats, isLoading }: SLADashboardCardProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const complianceRateFormatted = `${Math.round(stats.compliance_rate)}%`;
  const complianceColor = stats.compliance_rate >= 85 
    ? 'text-emerald-600 dark:text-emerald-400' 
    : stats.compliance_rate >= 70 
    ? 'text-amber-600 dark:text-amber-400' 
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="mb-6 space-y-3">
      {stats.high_priority_pending_alert > 0 && (
        <div className="flex items-center gap-3 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-300">
          <Flame className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 animate-bounce" />
          <div className="text-sm">
            <span className="font-semibold">Peringatan Tiket Darurat:</span> Terdapat{' '}
            <span className="font-bold underline">{stats.high_priority_pending_alert} komplain prioritas tinggi</span> yang belum ditanggapi. Segera lakukan triage dan tindakan mitigasi!
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Komplain */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Total Tiket</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.total_complaints}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {stats.open_complaints} aktif / terbuka
          </div>
        </div>

        {/* Tingkat Kepatuhan SLA */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Kepatuhan SLA</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className={`text-xl font-bold ${complianceColor}`}>
            {complianceRateFormatted}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Target standar &ge; 85%
          </div>
        </div>

        {/* Respon Pertama */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Avg First Response</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatDurationMinutes(stats.avg_first_response_minutes)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Waktu s/d tanggapan PIC
          </div>
        </div>

        {/* Waktu Penyelesaian */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Avg Resolution</span>
            <CheckCircle2 className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {formatDurationMinutes(stats.avg_resolution_minutes)}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Waktu s/d status selesai
          </div>
        </div>

        {/* Breached SLA */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Breached SLA</span>
            <ShieldAlert className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400">
            {stats.breached_count}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Tiket lewat tenggat waktu
          </div>
        </div>

        {/* Warning SLA */}
        <div className="p-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-1">
            <span className="text-xs font-medium">Mendekati Batas</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
            {stats.warning_count}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Sisa waktu &le; 4 jam
          </div>
        </div>
      </div>
    </div>
  );
}
