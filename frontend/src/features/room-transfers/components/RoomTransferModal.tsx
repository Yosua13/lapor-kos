'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRightLeft,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {
  previewRoomTransfer,
  createRoomTransfer,
  approveRoomTransfer,
  executeRoomTransfer,
} from '../api';
import { formatMinorMoney, formatDateDisplay } from '../format';
import type { TransferCalculation } from '../types';

interface Room {
  id: string;
  room_number: string;
  price_per_month: number;
  type?: string;
  status: string;
}

interface RoomTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  tenantName: string;
  currentRoomNumber: string;
  currentMonthlyRent: number;
  contractId?: string;
  availableRooms: Room[];
  isStaff?: boolean;
}

export function RoomTransferModal({
  isOpen,
  onClose,
  onSuccess,
  tenantId,
  tenantName,
  currentRoomNumber,
  currentMonthlyRent,
  contractId,
  availableRooms,
  isStaff = true,
}: RoomTransferModalProps) {
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');
  const [moveFee, setMoveFee] = useState<number>(0);

  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<TransferCalculation | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Filter available rooms (exclude current room)
  const selectableRooms = availableRooms.filter(
    (r) => r.room_number !== currentRoomNumber
  );

  // Auto trigger preview when room or date changes
  useEffect(() => {
    if (!selectedRoomId || !effectiveDate) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    let isMounted = true;
    const fetchPreview = async () => {
      setIsLoadingPreview(true);
      setPreviewError(null);
      try {
        const result = await previewRoomTransfer({
          tenant_id: tenantId,
          contract_id: contractId,
          to_room_id: selectedRoomId,
          effective_date: effectiveDate,
          move_fee_minor: moveFee,
        });
        if (isMounted) {
          setPreview(result);
        }
      } catch (err: any) {
        if (isMounted) {
          setPreview(null);
          setPreviewError(err.message || 'Gagal menghitung preview biaya');
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    };

    const timer = setTimeout(fetchPreview, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [selectedRoomId, effectiveDate, moveFee, tenantId, contractId]);

  if (!isOpen) return null;

  const handleSubmit = async (directExecute = false) => {
    if (!selectedRoomId) {
      setSubmitError('Pilih kamar baru terlebih dahulu');
      return;
    }
    if (!reason.trim()) {
      setSubmitError('Alasan pindah kamar wajib diisi');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Create transfer
      const transfer = await createRoomTransfer({
        tenant_id: tenantId,
        contract_id: contractId,
        to_room_id: selectedRoomId,
        effective_date: effectiveDate,
        reason: reason.trim(),
        move_fee_minor: moveFee,
      });

      // 2. If staff chooses direct execution: approve and execute immediately
      if (directExecute && isStaff) {
        await approveRoomTransfer(transfer.id);
        await executeRoomTransfer(transfer.id);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal memproses perpindahan kamar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-teal/10 flex items-center justify-center text-brand-teal">
              <ArrowRightLeft className="w-5 h-5 text-[#0e8a7a]" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-[18px] text-brand-navy">
                Pindah Kamar Terintegrasi
              </h3>
              <p className="text-[12px] text-gray-500">
                Pindahkan hunian <span className="font-semibold text-gray-700">{tenantName}</span> dengan penyesuaian biaya & histori otomatis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-[13px] text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Current vs Target Room Cards */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50/80 rounded-xl border border-gray-200/60">
            <div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Kamar Saat Ini
              </span>
              <p className="text-[16px] font-extrabold text-brand-navy">
                Kamar {currentRoomNumber || '-'}
              </p>
              <p className="text-[12px] text-gray-500">
                Rp {currentMonthlyRent.toLocaleString('id-ID')}/bln
              </p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                Kamar Tujuan
              </span>
              {selectedRoomId ? (
                (() => {
                  const r = selectableRooms.find((x) => x.id === selectedRoomId);
                  return (
                    <div>
                      <p className="text-[16px] font-extrabold text-[#0e8a7a]">
                        Kamar {r?.room_number}
                      </p>
                      <p className="text-[12px] text-gray-600">
                        Rp {r?.price_per_month.toLocaleString('id-ID')}/bln
                      </p>
                    </div>
                  );
                })()
              ) : (
                <p className="text-[13px] text-gray-400 italic">Belum dipilih</p>
              )}
            </div>
          </div>

          {/* Room Selection */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
              Pilih Kamar Tujuan <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-all"
            >
              <option value="">Pilih kamar yang tersedia...</option>
              {selectableRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  Kamar {r.room_number} {r.type ? `(${r.type})` : ''} - Rp{' '}
                  {r.price_per_month.toLocaleString('id-ID')}/bln
                </option>
              ))}
            </select>
            {selectableRooms.length === 0 && (
              <p className="text-red-500 text-[11px] mt-1.5">
                Tidak ada kamar kosong lain yang tersedia saat ini.
              </p>
            )}
          </div>

          {/* Date & Fee Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Tanggal Efektif Pindah <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
                Biaya Administrasi (Opsional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[13px] text-gray-400 font-medium">
                  Rp
                </span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={moveFee || ''}
                  placeholder="0"
                  onChange={(e) => setMoveFee(Number(e.target.value) || 0)}
                  className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-[12px] font-bold text-gray-700 mb-1.5">
              Alasan Pindah Kamar <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              placeholder="Contoh: Menginginkan kamar lebih luas / lantai 1..."
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a] resize-none"
            />
          </div>

          {/* Calculation Preview Section */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-gray-800 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-[#0e8a7a]" />
                Preview Perhitungan Biaya
              </span>
              {isLoadingPreview && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-teal">
                  <Loader2 className="w-3 h-3 animate-spin text-[#0e8a7a]" />
                  <span>Menghitung...</span>
                </div>
              )}
            </div>

            {previewError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{previewError}</span>
              </div>
            )}

            {preview && !previewError && (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2.5 text-[12px]">
                <div className="flex justify-between text-gray-500">
                  <span>Periode Tagihan Berjalan</span>
                  <span className="font-semibold text-gray-700">
                    {formatDateDisplay(preview.billing_period_start)} s/d{' '}
                    {formatDateDisplay(preview.billing_period_end)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Sisa Hari Aktif di Periode</span>
                  <span className="font-semibold text-gray-700">
                    {preview.active_days_remaining} hari (dari {preview.days_in_period} hari)
                  </span>
                </div>
                <div className="border-t border-gray-200/60 my-1" />
                <div className="flex justify-between text-gray-600">
                  <span>Prorata Sewa Kamar Baru ({preview.to_room_number})</span>
                  <span className="font-medium text-gray-800">
                    {formatMinorMoney(preview.new_rent_prorated_minor, preview.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Kredit Prorata Kamar Lama ({preview.from_room_number})</span>
                  <span className="font-medium text-emerald-600">
                    -{formatMinorMoney(preview.unused_old_rent_prorated_minor, preview.currency)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold text-gray-700">
                  <span>Selisih Sewa Prorata</span>
                  <span className={preview.rent_difference_minor >= 0 ? 'text-brand-navy' : 'text-emerald-600'}>
                    {formatMinorMoney(preview.rent_difference_minor, preview.currency)}
                  </span>
                </div>

                {preview.deposit_difference_minor !== 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Selisih Deposit</span>
                    <span className="font-medium text-gray-800">
                      {formatMinorMoney(preview.deposit_difference_minor, preview.currency)}
                    </span>
                  </div>
                )}

                {preview.move_fee_minor > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Biaya Administrasi</span>
                    <span className="font-medium text-gray-800">
                      {formatMinorMoney(preview.move_fee_minor, preview.currency)}
                    </span>
                  </div>
                )}

                {preview.credit_applied_minor > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Saldo Kredit Tenant Diterapkan</span>
                    <span className="font-medium">
                      -{formatMinorMoney(preview.credit_applied_minor, preview.currency)}
                    </span>
                  </div>
                )}

                <div className="border-t-2 border-slate-200 pt-2 flex justify-between items-center text-[13px] font-extrabold text-brand-navy">
                  <span>Total Penyesuaian (Adjustment)</span>
                  <span className="text-[15px] text-[#0e8a7a]">
                    {formatMinorMoney(preview.net_total_adjustment_minor, preview.currency)}
                  </span>
                </div>

                {preview.net_total_adjustment_minor !== 0 && (
                  <p className="text-[11px] text-gray-400 italic text-right">
                    *Invoice adjustment akan otomatis diterbitkan saat perpindahan selesai.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-[13px] font-bold transition-colors"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isSubmitting || !selectedRoomId || !reason.trim() || !preview}
            onClick={() => handleSubmit(false)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Receipt className="w-4 h-4" />
            )}
            Ajukan Pindah Kamar
          </button>

          {isStaff && (
            <button
              type="button"
              disabled={isSubmitting || !selectedRoomId || !reason.trim() || !preview}
              onClick={() => handleSubmit(true)}
              className="px-4 py-2 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-[#0e8a7a]/20"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Setujui & Pindahkan Sekarang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
