'use client';

import React from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Clock, Users, XCircle } from 'lucide-react';
import type { VisitorPermitSummary } from '../types';

interface VisitorSummaryCardsProps {
  summary: VisitorPermitSummary | null;
  isLoading?: boolean;
}

export function VisitorSummaryCards({ summary, isLoading }: VisitorSummaryCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/60 dark:bg-slate-800/60 p-4 shadow-sm" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const cards = [
    {
      title: 'Kunjungan Hari Ini',
      value: summary.total_today,
      icon: Calendar,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900/50',
    },
    {
      title: 'Tamu di Lokasi (Aktif)',
      value: summary.active_count,
      icon: Users,
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/40 border-cyan-100 dark:border-cyan-900/50',
    },
    {
      title: 'Menunggu Persetujuan',
      value: summary.pending_count,
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-100 dark:border-amber-900/50',
    },
    {
      title: 'Overstay Alert',
      value: summary.overstay_count,
      icon: AlertTriangle,
      color: summary.overstay_count > 0 ? 'text-rose-600 dark:text-rose-400 animate-bounce' : 'text-slate-400',
      bg: summary.overstay_count > 0
        ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 ring-2 ring-rose-500/20'
        : 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800',
    },
    {
      title: 'Ditolak / Batal',
      value: summary.rejected_count,
      icon: XCircle,
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/40 border-red-100 dark:border-red-900/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`flex flex-col justify-between rounded-2xl border p-4.5 shadow-sm transition-all hover:shadow-md ${c.bg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{c.title}</span>
              <Icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {c.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
