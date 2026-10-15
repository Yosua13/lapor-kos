'use client';

import React, { useState } from 'react';
import { 
  CheckCircle2, 
  HelpCircle, 
  MessageSquare, 
  RefreshCw, 
  ThumbsUp, 
  X 
} from 'lucide-react';

interface TenantResolutionActionsProps {
  complaintId: string;
  status: string;
  onConfirm: (comment?: string) => Promise<void>;
  onReopen: (reason: string) => Promise<void>;
}

export function TenantResolutionActions({
  complaintId,
  status,
  onConfirm,
  onReopen,
}: TenantResolutionActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmComment, setConfirmComment] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [isReopening, setIsReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [showReopenModal, setShowReopenModal] = useState(false);

  // AC 3: Tenant can confirm resolution or reopen when status is resolved (or confirmed to reopen)
  if (status !== 'resolved' && status !== 'confirmed') {
    return null;
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsConfirming(true);
      await onConfirm(confirmComment.trim() || undefined);
      setShowConfirmModal(false);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleReopenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenReason.trim()) return;

    try {
      setIsReopening(true);
      await onReopen(reopenReason.trim());
      setShowReopenModal(false);
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <>
      <div className="p-4 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl mb-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h4 className="text-sm font-semibold text-teal-900 dark:text-teal-100">
                {status === 'resolved'
                  ? 'Pengelola Menyatakan Komplain Telah Selesai'
                  : 'Komplain Telah Dikonfirmasi Tuntas'}
              </h4>
            </div>
            <p className="text-xs text-teal-700 dark:text-teal-300">
              {status === 'resolved'
                ? 'Mohon periksa hasil perbaikan pada kamar Anda. Jika sudah sesuai, konfirmasi selesai atau buka kembali jika kendala masih berlanjut.'
                : 'Terima kasih atas konfirmasi Anda. Jika sewaktu-waktu masalah terulang, Anda dapat membuka kembali tiket ini.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {status === 'resolved' && (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-xs"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Konfirmasi Selesai
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowReopenModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Buka Kembali Tiket
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                Konfirmasi Penyelesaian Masalah
              </h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Dengan menekan tombol konfirmasi, tiket akan ditutup secara permanen sebagai tuntas. Anda dapat memberikan catatan atau ulasan singkat kepada pengelola.
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Ulasan / Catatan Anda (Opsional)
                </label>
                <textarea
                  value={confirmComment}
                  onChange={(e) => setConfirmComment(e.target.value)}
                  placeholder="Misal: Terima kasih, teknisi sangat cepat dan masalah AC sudah dingin kembali."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isConfirming}
                  className="px-4 py-1.5 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isConfirming ? 'Menyimpan...' : 'Konfirmasi Selesai'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-rose-700 dark:text-rose-400 text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Buka Kembali Tiket Komplain
              </h3>
              <button
                onClick={() => setShowReopenModal(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReopenSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Jelaskan mengapa masalah belum terselesaikan atau kendala yang kembali muncul agar pengelola dapat segera menindaklanjuti.
              </p>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Alasan Membuka Kembali *
                </label>
                <textarea
                  required
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Contoh: AC masih meneteskan air setelah ditinggal teknisi kemarin sore."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReopenModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isReopening || !reopenReason.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isReopening ? 'Membuka Kembali...' : 'Buka Kembali Tiket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
