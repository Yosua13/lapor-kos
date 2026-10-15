'use client';

import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, HelpCircle, X, XCircle } from 'lucide-react';
import type { VisitorPermit } from '../types';
import { approveVisitorPermit, rejectVisitorPermit, requestChangeVisitorPermit } from '../api';
import { formatDateRange, formatVehicle } from '../format';

interface VisitorPermitApprovalModalProps {
  isOpen: boolean;
  permit: VisitorPermit | null;
  onClose: () => void;
  onSuccess: (updated: VisitorPermit) => void;
}

export function VisitorPermitApprovalModal({
  isOpen,
  permit,
  onClose,
  onSuccess,
}: VisitorPermitApprovalModalProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | 'change_requested'>('approve');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !permit) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if ((decision === 'reject' || decision === 'change_requested') && !reason.trim()) {
      setError('Alasan keputusan wajib diisi untuk penolakan atau permintaan perubahan.');
      return;
    }

    setIsLoading(true);
    try {
      let updated: VisitorPermit;
      if (decision === 'approve') {
        updated = await approveVisitorPermit(permit.id, reason.trim());
      } else if (decision === 'reject') {
        updated = await rejectVisitorPermit(permit.id, reason.trim());
      } else {
        updated = await requestChangeVisitorPermit(permit.id, reason.trim());
      }
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal memproses keputusan izin tamu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Tinjau Izin Tamu
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Kamar {permit.room_number || '-'} &bull; Penghuni: {permit.tenant_name || '-'}
            </p>
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
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Nama Tamu:</span>
            <span className="font-semibold text-slate-900 dark:text-white">{permit.guest_name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Hubungan / Relasi:</span>
            <span className="font-semibold text-slate-900 dark:text-white">{permit.relationship}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Jadwal Kunjungan:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {formatDateRange(permit.start_time, permit.end_time, permit.is_overnight)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Jumlah Tamu & Kendaraan:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {permit.total_guests} orang &bull; {formatVehicle(permit.vehicle_type, permit.vehicle_number)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Tujuan:</span>
            <span className="max-w-[240px] text-right font-medium text-slate-800 dark:text-slate-200">
              {permit.purpose}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Keputusan Pengelola <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDecision('approve')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-bold transition-all ${
                  decision === 'approve'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-400'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
                Setujui
              </button>

              <button
                type="button"
                onClick={() => setDecision('change_requested')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-bold transition-all ${
                  decision === 'change_requested'
                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm dark:bg-orange-950/40 dark:text-orange-400'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <HelpCircle className="h-5 w-5" />
                Minta Revisi
              </button>

              <button
                type="button"
                onClick={() => setDecision('reject')}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-xs font-bold transition-all ${
                  decision === 'reject'
                    ? 'border-red-500 bg-red-50 text-red-700 shadow-sm dark:bg-red-950/40 dark:text-red-400'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <XCircle className="h-5 w-5" />
                Tolak
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {decision === 'approve' ? 'Catatan Tambahan (Opsional)' : 'Alasan Keputusan'}{' '}
              {decision !== 'approve' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={3}
              required={decision !== 'approve'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                decision === 'approve'
                  ? 'Contoh: Disetujui. Harap lapor ke pos sekuriti saat tamu tiba.'
                  : 'Sebutkan alasan penolakan atau instruksi perubahan yang dibutuhkan penyewa...'
              }
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md disabled:opacity-50 ${
                decision === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : decision === 'reject'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Keputusan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
