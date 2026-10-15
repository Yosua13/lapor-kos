'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { applyVisitorRetention } from '../api';

interface VisitorRetentionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VisitorRetentionModal({ isOpen, onClose, onSuccess }: VisitorRetentionModalProps) {
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApply = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await applyVisitorRetention(days);
      setResult({ message: res.message, count: res.anonymized_count });
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Gagal menerapkan kebijakan retensi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Kebijakan Retensi Data Tamu
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pembersihan & Anonimisasi Privasi (AC 4)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {result ? (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900/40 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h4 className="mt-3 text-base font-bold text-emerald-900 dark:text-emerald-300">
                Retensi Berhasil Diterapkan
              </h4>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                {result.message}
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Tutup
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Sesuai dengan standar keamanan dan privasi data (GDPR/UU PDP), data identitas tamu (nama, nomor telepon, identitas kartu, dan plat nomor kendaraan) tidak boleh disimpan secara permanen.
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Pilih Batas Waktu Retensi:
              </label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value={14}>14 Hari (Ketat)</option>
                <option value={30}>30 Hari (Direkomendasikan)</option>
                <option value={60}>60 Hari (Standar Lanjutan)</option>
                <option value={90}>90 Hari (Maksimal)</option>
              </select>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                Data kunjungan berstatus <em>Selesai</em>, <em>Ditolak</em>, atau <em>Dibatalkan</em> yang lebih lama dari {days} hari akan dianonimkan. Histori tanggal kunjungan dan statistik tetap dipertahankan.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isLoading}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {isLoading ? 'Memproses...' : 'Terapkan Anonimisasi Sekarang'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
