'use client';

import React, { useEffect, useState } from 'react';
import { approveSettlement, cancelCheckout, executeCheckout, previewSettlement } from '../api';
import type { CheckoutCase, SettlementCalculation } from '../types';
import { formatCurrency, formatDate, getCheckoutStatusBadge } from '../format';
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle, DollarSign, Key, ShieldAlert, X } from 'lucide-react';

interface SettlementReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (checkout: CheckoutCase) => void;
  checkout: CheckoutCase;
}

export const SettlementReviewModal: React.FC<SettlementReviewModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  checkout,
}) => {
  const [calculation, setCalculation] = useState<SettlementCalculation | null>(null);
  const [loadingCalc, setLoadingCalc] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Execution states
  const [actualDate, setActualDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetRoomStatus, setTargetRoomStatus] = useState('cleaning');
  const [roomOverride, setRoomOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);

  useEffect(() => {
    if (isOpen && checkout.id) {
      setLoadingCalc(true);
      setError(null);
      previewSettlement(checkout.id)
        .then((res) => setCalculation(res))
        .catch((err) => setError(err.message || 'Gagal memuat preview settlement'))
        .finally(() => setLoadingCalc(false));
    }
  }, [isOpen, checkout.id]);

  if (!isOpen) return null;

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await approveSettlement(checkout.id);
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyetujui settlement');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecute = async () => {
    // AC 1 validation check
    if (!checkout.key_returned && !roomOverride) {
      setError('Kunci kamar belum diserahterimakan! Harap aktifkan centang override dan isi alasannya untuk melanjutkan.');
      return;
    }
    if (roomOverride && !overrideReason.trim()) {
      setError('Alasan override status kamar wajib diisi.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await executeCheckout(checkout.id, {
        actual_checkout_date: actualDate,
        target_room_status: targetRoomStatus,
        room_override: roomOverride,
        room_override_reason: overrideReason.trim(),
      });
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengeksekusi checkout');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError('Mohon isi alasan pembatalan checkout.');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      await cancelCheckout(checkout.id, cancelReason.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan checkout');
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = getCheckoutStatusBadge(checkout.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Review Final Settlement</h2>
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kamar {checkout.room_number || '-'} • Penghuni: {checkout.tenant_name || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="m-5 mb-0 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Handover & Info Singkat */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div>
              <span className="text-slate-400">Rencana Checkout:</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(checkout.scheduled_checkout_date)}</p>
            </div>
            <div>
              <span className="text-slate-400">Status Serah Kunci:</span>
              <p className="flex items-center gap-1 font-semibold">
                {checkout.key_returned ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" /> Kunci Sudah Diserahkan
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Key className="h-3.5 w-3.5" /> Belum Diserahkan
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Breakdown Perhitungan */}
          {loadingCalc ? (
            <div className="py-8 text-center text-xs text-slate-500">Menghitung rincian settlement...</div>
          ) : calculation ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Rincian Finansial Terpadu</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-700 dark:text-slate-300">
                    <span>Deposit Kontrak Berjalan</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(calculation.deposit_held_minor)}
                    </span>
                  </div>
                  {calculation.credit_balance_minor > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Saldo Lebih Bayar / Kredit Tenant</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(calculation.credit_balance_minor)}
                      </span>
                    </div>
                  )}
                  {calculation.unpaid_invoices_minor > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Tagihan Invoice Belum Lunas</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(calculation.unpaid_invoices_minor)}
                      </span>
                    </div>
                  )}
                  {calculation.damage_charges_minor > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Biaya Kerusakan Aset (Dari Inspeksi)</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(calculation.damage_charges_minor)}
                      </span>
                    </div>
                  )}
                  {calculation.utility_charges_minor > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Biaya Pemakaian Utility Akhir (Listrik/Air)</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(calculation.utility_charges_minor)}
                      </span>
                    </div>
                  )}
                  {calculation.other_charges_minor > 0 && (
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Biaya Lain-lain / Denda</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(calculation.other_charges_minor)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Kartu Hasil Akhir */}
              {calculation.settlement_type === 'refund' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Hasil: Pengembalian Sisa Deposit (Refund)
                      </span>
                      <div className="text-xl font-black text-emerald-800 dark:text-emerald-300">
                        {formatCurrency(calculation.refund_amount_minor)}
                      </div>
                    </div>
                    <DollarSign className="h-8 w-8 text-emerald-500 opacity-60" />
                  </div>
                  {checkout.bank_account_number && (
                    <div className="mt-2.5 rounded-lg border border-emerald-200/60 bg-white/70 p-2 text-xs text-slate-700 dark:border-emerald-800/60 dark:bg-slate-900/60 dark:text-slate-300">
                      Rekening Tujuan: <strong>{checkout.bank_name}</strong> • {checkout.bank_account_number} a.n. {checkout.bank_account_holder}
                    </div>
                  )}
                </div>
              )}

              {calculation.settlement_type === 'invoice' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-800 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Hasil: Kekurangan Bayar (Diterbitkan Invoice)
                      </span>
                      <div className="text-xl font-black text-rose-800 dark:text-rose-300">
                        {formatCurrency(calculation.invoice_amount_minor)}
                      </div>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-rose-500 opacity-60" />
                  </div>
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Deposit tidak mencukupi total tagihan & perbaikan. Invoice tagihan akhir otomatis dibuat saat eksekusi.
                  </p>
                </div>
              )}

              {calculation.settlement_type === 'zero_balance' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Hasil: Saldo Pas (Nol)</span>
                  <div className="text-xl font-black text-slate-800 dark:text-slate-200">Rp 0</div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Deposit pas untuk melunasi biaya pemakaian dan perbaikan. Tidak ada refund atau tagihan lanjutan.
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Form Eksekusi Penutupan Hunian */}
          {checkout.status !== 'completed' && checkout.status !== 'cancelled' && (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h4 className="mb-3 text-xs font-bold text-slate-900 dark:text-white">Opsi Penutupan & Kamar (AC 1)</h4>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                <div>
                  <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Tanggal Realisasi Checkout</label>
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-slate-600 dark:text-slate-400">Status Kamar Setelah Checkout</label>
                  <select
                    value={targetRoomStatus}
                    onChange={(e) => setTargetRoomStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="cleaning">Cleaning (Pembersihan - Direkomendasikan)</option>
                    <option value="available">Available (Siap Huni - Butuh Override)</option>
                    <option value="maintenance">Maintenance (Perbaikan)</option>
                  </select>
                </div>
              </div>

              {/* AC 1 Override Box */}
              {(!checkout.key_returned || targetRoomStatus === 'available') && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Perhatian Otorisasi Kamar (AC 1)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-400">
                    Kamar tidak boleh otomatis menjadi Available sebelum inspeksi dan serah terima kunci lengkap, kecuali dilakukan override beralasan.
                  </p>
                  <label className="mt-2.5 flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={roomOverride}
                      onChange={(e) => setRoomOverride(e.target.checked)}
                      className="rounded border-amber-300"
                    />
                    <span>Konfirmasi Override Otorisasi Status Kamar</span>
                  </label>
                  {roomOverride && (
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Alasan override (Wajib diisi, misal: kunci ditinggal di meja/kamar bersih)"
                      className="mt-2 w-full rounded border border-amber-300 bg-white p-1.5 text-xs text-slate-900 dark:bg-slate-900 dark:text-white"
                      required
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Pembatalan Prompt */}
          {showCancelPrompt && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/30">
              <span className="font-bold text-rose-800 dark:text-rose-300">Alasan Pembatalan Checkout:</span>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Misal: Tenant membatalkan pindah dan memperpanjang sewa"
                className="mt-1.5 w-full rounded border border-rose-300 bg-white p-1.5 text-xs text-slate-900 dark:bg-slate-900 dark:text-white"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(false)}
                  className="rounded px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                >
                  {actionLoading ? 'Membatalkan...' : 'Konfirmasi Batal'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-200 p-4 dark:border-slate-800 gap-2">
          <div>
            {!showCancelPrompt && checkout.status !== 'completed' && checkout.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setShowCancelPrompt(true)}
                className="text-xs font-medium text-rose-600 hover:underline dark:text-rose-400"
              >
                Batalkan Checkout
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Tutup
            </button>

            {checkout.status !== 'approved' && checkout.status !== 'completed' && checkout.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading || loadingCalc}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? 'Menyetujui...' : 'Setujui Statement'}
              </button>
            )}

            {checkout.status !== 'completed' && checkout.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={actionLoading || loadingCalc}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle className="h-4 w-4" />
                {actionLoading ? 'Memproses...' : 'Eksekusi Checkout Selesai'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
