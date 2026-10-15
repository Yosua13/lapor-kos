'use client';

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, QrCode, ShieldCheck, X } from 'lucide-react';
import type { VisitorPermit } from '../types';
import { formatDateRange, formatVehicle, getVisitorStatusBadge } from '../format';

interface VisitorPassModalProps {
  isOpen: boolean;
  permit: VisitorPermit | null;
  onClose: () => void;
}

export function VisitorPassModal({ isOpen, permit, onClose }: VisitorPassModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !permit) return null;

  const passToken = permit.pass_token || 'BELUM_DITERBITKAN';
  const badge = getVisitorStatusBadge(permit.status, permit.is_overstay);
  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/visitor-pass/${passToken}`
    : `/visitor-pass/${passToken}`;

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Digital Pass Card */}
        <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-md dark:border-cyan-900/40 dark:from-slate-900 dark:via-slate-800 dark:to-cyan-950/40">
          <div className="flex items-center justify-between border-b border-cyan-100/60 pb-3 dark:border-cyan-800/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-extrabold tracking-wider text-cyan-800 uppercase dark:text-cyan-300">
                Visitor Pass Digital
              </span>
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          <div className="mt-4 text-center">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              {permit.property_name || 'Lapor Kos'}
            </p>
            <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
              Kamar {permit.room_number || '-'}
            </h3>
            <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">
              Penghuni: {permit.tenant_name || '-'}
            </p>
          </div>

          {/* Simulated QR Code Box */}
          <div className="my-5 flex flex-col items-center justify-center">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-inner dark:border-slate-700 dark:bg-slate-800">
              <QrCode className="h-32 w-32 text-slate-800 dark:text-slate-100" />
            </div>
            <p className="mt-2 font-mono text-xs font-extrabold tracking-widest text-slate-700 dark:text-slate-300">
              {passToken}
            </p>
          </div>

          {/* Details table */}
          <div className="space-y-2 rounded-2xl bg-white/70 p-3.5 text-xs backdrop-blur-sm dark:bg-slate-900/60">
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Nama Tamu:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{permit.guest_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Relasi:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{permit.relationship}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Jadwal Izin:</span>
              <span className="font-medium text-right text-slate-700 dark:text-slate-300">
                {formatDateRange(permit.start_time, permit.end_time, permit.is_overnight)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Kendaraan:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {formatVehicle(permit.vehicle_type, permit.vehicle_number)}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Link Actions */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                Tautan Berhasil Disalin!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Salin Tautan Verifikasi Satpam / Tamu
              </>
            )}
          </button>

          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-cyan-600 hover:bg-cyan-50 dark:border-slate-700 dark:text-cyan-400 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Buka Halaman Verifikasi Publik
          </a>
        </div>
      </div>
    </div>
  );
}
