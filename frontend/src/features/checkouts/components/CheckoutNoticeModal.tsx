'use client';

import React, { useState } from 'react';
import { createCheckout } from '../api';
import type { CheckoutCase } from '../types';
import { AlertCircle, Calendar, CreditCard, Home, X } from 'lucide-react';

interface CheckoutNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (checkout: CheckoutCase) => void;
  contractId?: string;
  tenantName?: string;
  roomNumber?: string;
}

export const CheckoutNoticeModal: React.FC<CheckoutNoticeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  contractId = '',
  tenantName = '',
  roomNumber = '',
}) => {
  const [contractID, setContractID] = useState(contractId);
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('');
  const [forwardingAddress, setForwardingAddress] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractID || !scheduledDate || !reason.trim()) {
      setError('Mohon lengkapi ID kontrak, tanggal rencana checkout, dan alasan.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await createCheckout({
        contract_id: contractID,
        scheduled_checkout_date: scheduledDate,
        reason: reason.trim(),
        forwarding_address: forwardingAddress.trim(),
        bank_name: bankName.trim(),
        bank_account_number: accountNumber.trim(),
        bank_account_holder: accountHolder.trim(),
      });
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengajukan notice checkout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Tutup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ajukan Notice Checkout</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {roomNumber ? `Kamar ${roomNumber}` : ''} {tenantName ? `• ${tenantName}` : ''}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!contractId && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                ID Kontrak Aktif <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={contractID}
                onChange={(e) => setContractID(e.target.value)}
                placeholder="Masukkan UUID kontrak aktif"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Rencana Tanggal Checkout <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 pl-10 text-sm focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Alasan Checkout / Pindah <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Habis masa sewa, pindah kantor, lulus kuliah"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Alamat Pengiriman Surat / Alamat Baru (Opsional)
            </label>
            <input
              type="text"
              value={forwardingAddress}
              onChange={(e) => setForwardingAddress(e.target.value)}
              placeholder="Alamat domisili setelah checkout"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Rekening Pengembalian Deposit (Jika Ada Sisa Refund)</span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Nama Bank (e.g. BCA, Mandiri)"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Nomor Rekening"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              placeholder="Nama Pemilik Rekening Sesuai Buku Tabungan"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : 'Kirim Notice Checkout'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
