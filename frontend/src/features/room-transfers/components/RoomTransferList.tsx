'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Loader2,
  AlertCircle,
  FileText,
  User,
  X,
} from 'lucide-react';
import {
  listRoomTransfers,
  approveRoomTransfer,
  rejectRoomTransfer,
  executeRoomTransfer,
  cancelRoomTransfer,
} from '../api';
import { formatDateDisplay, formatMinorMoney, getTransferStatusBadge } from '../format';
import type { RoomTransfer, RoomTransferStatus } from '../types';

export function RoomTransferList() {
  const [transfers, setTransfers] = useState<RoomTransfer[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reject modal state
  const [rejectingTransferId, setRejectingTransferId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchTransfers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listRoomTransfers(selectedStatus || undefined);
      setTransfers(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar pengajuan pindah kamar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus]);

  const handleApprove = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menyetujui pengajuan pindah kamar ini?')) return;
    setIsProcessing(true);
    try {
      await approveRoomTransfer(id);
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui pengajuan');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async (id: string) => {
    if (!confirm('Eksekusi perpindahan kamar sekarang? Periode hunian akan diperbarui dan invoice penyesuaian akan diterbitkan.')) return;
    setIsProcessing(true);
    try {
      await executeRoomTransfer(id);
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message || 'Gagal mengeksekusi perpindahan kamar');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingTransferId || !rejectReason.trim()) return;
    setIsProcessing(true);
    try {
      await rejectRoomTransfer(rejectingTransferId, rejectReason.trim());
      setRejectingTransferId(null);
      setRejectReason('');
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message || 'Gagal menolak pengajuan');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Batalkan pengajuan pindah kamar ini?')) return;
    setIsProcessing(true);
    try {
      await cancelRoomTransfer(id);
      await fetchTransfers();
    } catch (err: any) {
      alert(err.message || 'Gagal membatalkan pengajuan');
    } finally {
      setIsProcessing(false);
    }
  };

  const statuses: { label: string; value: string }[] = [
    { label: 'Semua Status', value: '' },
    { label: 'Menunggu Persetujuan', value: 'pending' },
    { label: 'Disetujui', value: 'approved' },
    { label: 'Selesai', value: 'completed' },
    { label: 'Ditolak', value: 'rejected' },
    { label: 'Dibatalkan', value: 'cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {statuses.map((s) => (
          <button
            key={s.value}
            onClick={() => setSelectedStatus(s.value)}
            className={`px-3.5 py-1.5 rounded-xl text-[13px] font-bold transition-all ${
              selectedStatus === s.value
                ? 'bg-brand-navy text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#0e8a7a]" />
          <p className="text-[14px]">Memuat daftar pengajuan...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          {error}
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">
          <ArrowRightLeft className="w-12 h-12 mx-auto text-gray-300 mb-3 stroke-[1.5]" />
          <h4 className="text-[16px] font-bold text-gray-700">Tidak Ada Pengajuan</h4>
          <p className="text-[13px] text-gray-400 mt-1">
            Belum ada pengajuan pindah kamar untuk filter yang dipilih.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transfers.map((t) => {
            const badge = getTransferStatusBadge(t.status);
            const calc = t.calculation_preview;

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 hover:border-gray-200 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0e8a7a]">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-[16px] text-brand-navy">
                          Kamar {t.from_room_number || '-'} &rarr; Kamar {t.to_room_number || '-'}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-gray-500">
                        Penghuni: <strong className="text-gray-700">{t.tenant_name || '-'}</strong>
                        {t.requested_by_name && (
                          <span> &bull; Diajukan oleh: {t.requested_by_name}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 uppercase tracking-wider block">
                      Tanggal Efektif
                    </span>
                    <p className="text-[13px] font-bold text-gray-800 flex items-center justify-end gap-1">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {formatDateDisplay(t.effective_date)}
                    </p>
                  </div>
                </div>

                {/* Reason & Calculation Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50/70 rounded-xl border border-gray-200/50 text-[12px]">
                  <div>
                    <span className="font-bold text-gray-700 block mb-1">Alasan Pindah</span>
                    <p className="text-gray-600 italic">&ldquo;{t.reason}&rdquo;</p>
                    {t.rejection_reason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700">
                        <strong>Alasan Penolakan:</strong> {t.rejection_reason}
                      </div>
                    )}
                  </div>

                  {calc && (
                    <div className="space-y-1 md:border-l md:border-gray-200 md:pl-4">
                      <div className="flex justify-between text-gray-600">
                        <span>Selisih Sewa Prorata:</span>
                        <span className="font-semibold text-gray-800">
                          {formatMinorMoney(calc.rent_difference_minor, calc.currency)}
                        </span>
                      </div>
                      {calc.deposit_difference_minor !== 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Selisih Deposit:</span>
                          <span className="font-semibold text-gray-800">
                            {formatMinorMoney(calc.deposit_difference_minor, calc.currency)}
                          </span>
                        </div>
                      )}
                      {calc.move_fee_minor > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Biaya Administrasi:</span>
                          <span className="font-semibold text-gray-800">
                            {formatMinorMoney(calc.move_fee_minor, calc.currency)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-[13px] font-bold text-brand-navy pt-1 border-t border-gray-200/60">
                        <span>Total Penyesuaian Biaya:</span>
                        <span className="text-[#0e8a7a]">
                          {formatMinorMoney(calc.net_total_adjustment_minor, calc.currency)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions & Timestamps */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] text-gray-400">
                    Dibuat: {formatDateDisplay(t.created_at)}
                    {t.completed_at && ` • Selesai: ${formatDateDisplay(t.completed_at)}`}
                  </span>

                  <div className="flex items-center gap-2">
                    {t.status === 'pending' && (
                      <>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleApprove(t.id)}
                          className="px-3 py-1.5 bg-brand-teal hover:bg-[#0c7668] bg-[#0e8a7a] text-white rounded-xl text-[12px] font-bold transition-colors flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Setujui
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => setRejectingTransferId(t.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Tolak
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleCancel(t.id)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[12px] font-medium transition-colors"
                        >
                          Batalkan
                        </button>
                      </>
                    )}

                    {t.status === 'approved' && (
                      <>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleExecute(t.id)}
                          className="px-4 py-1.5 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-xl text-[12px] font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Eksekusi Pindah Kamar
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => setRejectingTransferId(t.id)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[12px] font-bold transition-colors flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Tolak
                        </button>
                      </>
                    )}

                    {t.status === 'completed' && t.adjustment_invoice_id && (
                      <span className="text-[12px] text-gray-500 flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-gray-500" />
                        Invoice Adjustment Terbit
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingTransferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="font-bold text-[16px] text-brand-navy">Tolak Pengajuan Pindah</h4>
              <button
                onClick={() => setRejectingTransferId(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Jelaskan alasan penolakan..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-[13px] text-brand-navy focus:outline-none focus:border-red-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingTransferId(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-[13px] font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
                >
                  Tolak Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
