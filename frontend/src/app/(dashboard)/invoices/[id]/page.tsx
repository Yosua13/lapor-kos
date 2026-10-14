'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Plus,
  ReceiptText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import type {
  AdjustmentPayload,
  AdjustmentPreview,
  Invoice,
} from '@/features/invoices/types';
import {
  createAdjustment,
  getInvoice,
  previewAdjustment,
} from '@/features/invoices/api';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  invoiceStatusLabel,
  invoiceStatusTone,
  invoiceTypeLabel,
  itemTypeLabel,
} from '@/features/invoices/format';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, isTenant } = useAuthorization();
  const canWrite = can(CAPABILITIES.INVOICE_WRITE);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Adjustment state
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentPayload>({
    description: '',
    amount_minor: 0,
    reason: '',
  });
  const [adjustmentPreviewData, setAdjustmentPreviewData] = useState<AdjustmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getInvoice(params.id, isTenant);
      setInvoice(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat invoice.');
    } finally {
      setLoading(false);
    }
  }, [params.id, isTenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePreviewAdjustment = async () => {
    if (!invoice) return;
    if (!adjustmentForm.description.trim() || !adjustmentForm.reason.trim() || adjustmentForm.amount_minor === 0) {
      setError('Deskripsi, alasan, dan nominal tidak boleh kosong atau nol.');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const preview = await previewAdjustment(invoice.id, adjustmentForm);
      setAdjustmentPreviewData(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat preview penyesuaian.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmitAdjustment = async () => {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      await createAdjustment(invoice.id, adjustmentForm);
      setNotice('Penyesuaian tagihan berhasil dibuat.');
      setShowAdjustmentForm(false);
      setAdjustmentPreviewData(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan penyesuaian.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="font-bold">{error || 'Invoice tidak ditemukan.'}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/invoices')}
          className="font-semibold text-brand-teal hover:underline"
        >
          &larr; Kembali ke Daftar Invoice
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      {/* Top Bar */}
      <div>
        <button
          type="button"
          onClick={() => router.push('/invoices')}
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-teal transition"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar Invoice
        </button>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-extrabold text-brand-navy lg:text-3xl">
              {invoice.invoice_number}
            </h1>
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-bold ${
                invoiceStatusTone[invoice.status]
              }`}
            >
              {invoiceStatusLabel[invoice.status]}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {invoiceTypeLabel[invoice.invoice_type]}
            </span>
          </div>

          <div className="text-xs text-slate-500">
            Periode: <span className="font-bold text-slate-700">{formatPeriod(invoice.billing_period)}</span> · Jatuh Tempo:{' '}
            <span className="font-bold text-slate-700">{formatDate(invoice.due_at)}</span>
          </div>
        </div>
      </div>

      {/* Notices */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{notice}</p>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Details & Line Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Metadata Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Informasi Kontrak & Hunian
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs text-slate-400 font-semibold">Penghuni</dt>
                <dd className="mt-0.5 font-bold text-slate-800">{invoice.tenant_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 font-semibold">Kamar</dt>
                <dd className="mt-0.5 font-bold text-slate-800">Kamar {invoice.room_number || '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 font-semibold">Contract ID</dt>
                <dd className="mt-0.5 font-mono text-xs text-slate-600 truncate">{invoice.contract_id}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400 font-semibold">Mata Uang</dt>
                <dd className="mt-0.5 font-semibold text-slate-800">{invoice.currency}</dd>
              </div>
            </dl>
          </div>

          {/* Line Items Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Rincian Line Item Tagihan
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Deskripsi</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3 text-right">Kuantitas</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-slate-800">{item.description}</div>
                          {item.reason && <div className="text-xs text-slate-500">Alasan: {item.reason}</div>}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                            {itemTypeLabel[item.item_type] || item.item_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right text-slate-600">{item.quantity}</td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                          {formatMoney(item.amount_minor, invoice.currency)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Tidak ada line item.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Linked Adjustments */}
          {invoice.adjustments && invoice.adjustments.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Penyesuaian (Adjustment Invoices)
              </h2>
              <div className="space-y-2">
                {invoice.adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3 bg-slate-50/50 text-sm"
                  >
                    <div>
                      <span className="font-mono font-bold text-brand-navy">{adj.invoice_number}</span>
                      <span className="ml-2 text-slate-500">
                        {adj.items?.[0]?.description || 'Penyesuaian'}
                      </span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {formatMoney(adj.total_minor, adj.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Trail Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Audit Trail & Histori Event
            </h2>
            <div className="space-y-4 border-l-2 border-slate-200 pl-4 text-xs">
              {invoice.events && invoice.events.length > 0 ? (
                invoice.events.map((evt) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-teal" />
                    <div className="font-bold text-slate-800 text-sm">{evt.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-slate-400">{formatDate(evt.created_at)}</div>
                    {evt.reason && <p className="mt-1 text-slate-600">{evt.reason}</p>}
                  </div>
                ))
              ) : (
                <p className="text-slate-400">Belum ada catatan event.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Financial Summary & Actions */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Rekonsiliasi Pembayaran
            </h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Tagihan:</span>
                <span className="font-bold text-slate-800">
                  {formatMoney(invoice.total_minor, invoice.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Teralokasi:</span>
                <span className="font-bold text-emerald-600">
                  - {formatMoney(invoice.allocated_minor, invoice.currency)}
                </span>
              </div>
              {invoice.credit_applied_minor > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Kredit Diterapkan:</span>
                  <span className="font-bold text-emerald-600">
                    - {formatMoney(invoice.credit_applied_minor, invoice.currency)}
                  </span>
                </div>
              )}
              <div className="border-t border-slate-200 pt-3 flex justify-between text-base font-extrabold">
                <span className="text-brand-navy">Sisa Tagihan:</span>
                <span className={invoice.outstanding_minor > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                  {formatMoney(invoice.outstanding_minor, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Staff Adjustment Form */}
          {!isTenant && canWrite && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Penyesuaian (Adjustment)
                </h2>
                {showAdjustmentForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdjustmentForm(false);
                      setAdjustmentPreviewData(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Batal
                  </button>
                )}
              </div>

              {!showAdjustmentForm ? (
                <button
                  type="button"
                  onClick={() => setShowAdjustmentForm(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  Buat Penyesuaian Tagihan
                </button>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <label htmlFor="adj-deskripsi" className="block font-semibold text-slate-600">Deskripsi Item</label>
                    <input
                      id="adj-deskripsi"
                      type="text"
                      placeholder="Cth: Keringanan atau penalti"
                      value={adjustmentForm.description}
                      onChange={(e) =>
                        setAdjustmentForm({ ...adjustmentForm, description: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="adj-nominal" className="block font-semibold text-slate-600">Nominal (+ Tambah / - Diskon)</label>
                    <input
                      id="adj-nominal"
                      type="number"
                      placeholder="-50000"
                      value={adjustmentForm.amount_minor || ''}
                      onChange={(e) =>
                        setAdjustmentForm({
                          ...adjustmentForm,
                          amount_minor: parseInt(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="adj-alasan" className="block font-semibold text-slate-600">Alasan Penyesuaian (Wajib Audit)</label>
                    <input
                      id="adj-alasan"
                      type="text"
                      placeholder="Alasan yang jelas"
                      value={adjustmentForm.reason}
                      onChange={(e) =>
                        setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>

                  {/* Preview Box */}
                  {adjustmentPreviewData && (
                    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 text-xs space-y-1">
                      <p className="font-bold text-teal-900">Preview Dampak:</p>
                      <div className="flex justify-between text-slate-600">
                        <span>Sisa Saat Ini:</span>
                        <span>{formatMoney(adjustmentPreviewData.current_outstanding_minor)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Penyesuaian:</span>
                        <span className={adjustmentPreviewData.adjustment_minor < 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                          {formatMoney(adjustmentPreviewData.adjustment_minor)}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-teal-200 pt-1 font-extrabold text-brand-navy">
                        <span>Sisa Baru:</span>
                        <span>{formatMoney(adjustmentPreviewData.combined_outstanding_minor)}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handlePreviewAdjustment}
                      disabled={previewLoading || !adjustmentForm.amount_minor}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 font-bold text-slate-700 hover:border-brand-teal disabled:opacity-50"
                    >
                      {previewLoading ? 'Menghitung...' : 'Preview Dampak'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitAdjustment}
                      disabled={busy || !adjustmentPreviewData}
                      className="w-full rounded-xl bg-brand-teal py-2 font-bold text-white hover:bg-[#0c7668] disabled:opacity-50"
                    >
                      {busy ? 'Menyimpan...' : 'Terapkan Penyesuaian'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
