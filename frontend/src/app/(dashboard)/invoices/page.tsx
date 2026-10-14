'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  History,
  Info,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  Sliders,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import type {
  AdjustmentPayload,
  AdjustmentPreview,
  BillingJob,
  BillingPolicy,
  Invoice,
  InvoiceList,
  MeterReadingPayload,
} from '@/features/invoices/types';
import {
  createAdjustment,
  createFinalSettlement,
  generateInvoices,
  getBillingPolicy,
  getInvoice,
  listBillingJobs,
  listInvoices,
  previewAdjustment,
  recordMeterReading,
  updateBillingPolicy,
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

type Tab = 'invoices' | 'jobs' | 'policy';

export default function InvoicesPage() {
  const router = useRouter();
  const { can, isTenant } = useAuthorization();
  const { activeProperty } = useActiveProperty();

  const canRead = can(CAPABILITIES.INVOICE_READ);
  const canWrite = can(CAPABILITIES.INVOICE_WRITE);
  const canGenerate = can(CAPABILITIES.INVOICE_GENERATE);

  const [activeTab, setActiveTab] = useState<Tab>('invoices');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // List filters & pagination
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<string>('');

  // Selected invoice for detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePeriod, setGeneratePeriod] = useState(new Date().toISOString().slice(0, 7));
  const [generateResult, setGenerateResult] = useState<BillingJob | null>(null);

  const [showMeterModal, setShowMeterModal] = useState(false);
  const [meterForm, setMeterForm] = useState<MeterReadingPayload>({
    contract_id: '',
    billing_period: new Date().toISOString().slice(0, 7),
    utility_type: 'electricity',
    previous_value: 0,
    current_value: 0,
    unit_price_minor: 1500,
    notes: '',
  });

  // Policy state
  const [policy, setPolicy] = useState<BillingPolicy | null>(null);
  const [policyForm, setPolicyForm] = useState<Partial<BillingPolicy>>({});

  // Billing jobs state
  const [jobs, setJobs] = useState<BillingJob[]>([]);

  // Adjustment state inside detail modal
  const [showAdjustmentForm, setShowAdjustmentForm] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentPayload>({
    description: '',
    amount_minor: 0,
    reason: '',
  });
  const [adjustmentPreviewData, setAdjustmentPreviewData] = useState<AdjustmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load Invoices
  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: InvoiceList = await listInvoices(
        isTenant,
        page,
        pageSize,
        filterStatus,
        filterPeriod,
      );
      setInvoices(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalItems(data.total_items || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat invoice.');
    } finally {
      setLoading(false);
    }
  }, [isTenant, page, pageSize, filterStatus, filterPeriod]);

  // Load Jobs
  const fetchJobs = useCallback(async () => {
    if (isTenant) return;
    try {
      const data = await listBillingJobs(20);
      setJobs(data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  }, [isTenant]);

  // Load Policy
  const fetchPolicy = useCallback(async () => {
    if (isTenant) return;
    try {
      const data = await getBillingPolicy();
      setPolicy(data);
      setPolicyForm(data);
    } catch (err) {
      console.error('Failed to load policy:', err);
    }
  }, [isTenant]);

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (activeTab === 'jobs') void fetchJobs();
    if (activeTab === 'policy') void fetchPolicy();
  }, [activeTab, fetchJobs, fetchPolicy]);

  // Open invoice detail
  const handleOpenDetail = async (inv: Invoice) => {
    setDetailLoading(true);
    setSelectedInvoice(inv);
    setShowAdjustmentForm(false);
    setAdjustmentPreviewData(null);
    setAdjustmentForm({ description: '', amount_minor: 0, reason: '' });
    try {
      const full = await getInvoice(inv.id, isTenant);
      setSelectedInvoice(full);
    } catch (err) {
      console.error('Failed to fetch full invoice:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Run Adjustment Preview
  const handlePreviewAdjustment = async () => {
    if (!selectedInvoice) return;
    if (!adjustmentForm.description.trim() || !adjustmentForm.reason.trim() || adjustmentForm.amount_minor === 0) {
      setError('Deskripsi, alasan, dan nominal tidak boleh kosong atau nol.');
      return;
    }
    setPreviewLoading(true);
    setError(null);
    try {
      const preview = await previewAdjustment(selectedInvoice.id, adjustmentForm);
      setAdjustmentPreviewData(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat preview penyesuaian.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Submit Adjustment
  const handleSubmitAdjustment = async () => {
    if (!selectedInvoice) return;
    setBusy(true);
    setError(null);
    try {
      await createAdjustment(selectedInvoice.id, adjustmentForm);
      setNotice('Penyesuaian tagihan berhasil dibuat.');
      setShowAdjustmentForm(false);
      setAdjustmentPreviewData(null);
      // Reload full invoice
      const full = await getInvoice(selectedInvoice.id, isTenant);
      setSelectedInvoice(full);
      void fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan penyesuaian.');
    } finally {
      setBusy(false);
    }
  };

  // Generate Invoices
  const handleGenerate = async () => {
    if (!generatePeriod) return;
    setBusy(true);
    setError(null);
    try {
      const result = await generateInvoices(generatePeriod);
      setGenerateResult(result);
      setNotice(`Job penagihan periode ${generatePeriod} berhasil dijalankan.`);
      void fetchInvoices();
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghasilkan tagihan.');
    } finally {
      setBusy(false);
    }
  };

  // Submit Meter Reading
  const handleRecordMeter = async () => {
    if (!meterForm.contract_id.trim()) {
      setError('Contract ID wajib diisi.');
      return;
    }
    if (meterForm.current_value < meterForm.previous_value) {
      setError('Angka meter saat ini tidak boleh lebih kecil dari angka sebelumnya.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await recordMeterReading(meterForm);
      setNotice('Pencatatan meter utilitas berhasil disimpan.');
      setShowMeterModal(false);
      setMeterForm({
        contract_id: '',
        billing_period: new Date().toISOString().slice(0, 7),
        utility_type: 'electricity',
        previous_value: 0,
        current_value: 0,
        unit_price_minor: 1500,
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat meter.');
    } finally {
      setBusy(false);
    }
  };

  // Save Billing Policy
  const handleSavePolicy = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await updateBillingPolicy(policyForm);
      setPolicy(updated);
      setPolicyForm(updated);
      setNotice('Kebijakan billing berhasil diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui kebijakan billing.');
    } finally {
      setBusy(false);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    const totalOutstanding = invoices.reduce((acc, inv) => acc + (inv.outstanding_minor || 0), 0);
    const totalAllocated = invoices.reduce((acc, inv) => acc + (inv.allocated_minor || 0), 0);
    const overdueCount = invoices.filter((inv) => inv.status === 'overdue').length;
    const unpaidCount = invoices.filter((inv) => inv.status === 'issued' || inv.status === 'partially_paid' || inv.status === 'overdue').length;
    return { totalOutstanding, totalAllocated, overdueCount, unpaidCount };
  }, [invoices]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-teal/10 p-2 text-brand-teal">
              <ReceiptText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-brand-navy lg:text-3xl">
                {isTenant ? 'Invoice & Tagihan Saya' : 'Invoice & Tagihan'}
              </h1>
              <p className="text-sm text-slate-500">
                {isTenant
                  ? 'Pantau rincian biaya sewa, pemakaian utility, dan status pembayaran Anda'
                  : `Kelola billing engine, penyesuaian, dan rekonsiliasi ${activeProperty ? `(${activeProperty.name})` : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons for Staff */}
        {!isTenant && (
          <div className="flex flex-wrap items-center gap-2">
            {canGenerate && (
              <button
                type="button"
                onClick={() => {
                  setGenerateResult(null);
                  setShowGenerateModal(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0c7668] transition"
              >
                <Zap className="h-4 w-4" />
                Generate Tagihan
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                onClick={() => setShowMeterModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-brand-teal hover:text-brand-teal transition"
              >
                <Gauge className="h-4 w-4" />
                Catat Meter
              </button>
            )}
          </div>
        )}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Invoice</p>
          <p className="mt-2 text-2xl font-extrabold text-brand-navy">{totalItems}</p>
          <p className="mt-1 text-xs text-slate-500">{stats.unpaidCount} invoice belum lunas</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-600">Total Sisa Tagihan</p>
          <p className="mt-2 text-2xl font-extrabold text-rose-700">{formatMoney(stats.totalOutstanding)}</p>
          <p className="mt-1 text-xs text-rose-600/80">Outstanding aktif</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Terbayar (Alokasi)</p>
          <p className="mt-2 text-2xl font-extrabold text-emerald-700">{formatMoney(stats.totalAllocated)}</p>
          <p className="mt-1 text-xs text-emerald-600/80">Teralokasi ke invoice</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Jatuh Tempo / Terlambat</p>
          <p className="mt-2 text-2xl font-extrabold text-amber-700">{stats.overdueCount}</p>
          <p className="mt-1 text-xs text-amber-600/80">Memerlukan penanganan</p>
        </div>
      </div>

      {/* Staff Tabs */}
      {!isTenant && (
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`pb-3 text-sm font-bold transition border-b-2 ${
                activeTab === 'invoices'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Daftar Tagihan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('jobs')}
              className={`pb-3 text-sm font-bold transition border-b-2 ${
                activeTab === 'jobs'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Riwayat Job Billing
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('policy')}
              className={`pb-3 text-sm font-bold transition border-b-2 ${
                activeTab === 'policy'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Kebijakan Billing
            </button>
          </div>
        </div>
      )}

      {/* Tab: Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="filter-status" className="sr-only">Status</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-teal focus:outline-none"
                >
                  <option value="">Semua Status</option>
                  <option value="issued">Terbit</option>
                  <option value="partially_paid">Dibayar sebagian</option>
                  <option value="paid">Lunas</option>
                  <option value="overdue">Terlambat</option>
                  <option value="draft">Draf</option>
                  <option value="void">Dibatalkan</option>
                </select>
              </div>

              <div>
                <label htmlFor="filter-period" className="sr-only">Periode</label>
                <input
                  id="filter-period"
                  type="month"
                  value={filterPeriod}
                  onChange={(e) => {
                    setFilterPeriod(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-brand-teal focus:outline-none"
                  placeholder="YYYY-MM"
                />
              </div>

              {(filterStatus || filterPeriod) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('');
                    setFilterPeriod('');
                    setPage(1);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-teal"
                >
                  Reset Filter
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-400">
              Menampilkan {invoices.length} dari {totalItems} tagihan
            </div>
          </div>

          {/* Invoices List / Table */}
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                <FileText className="h-8 w-8" />
              </div>
              <p className="mt-3 font-bold text-slate-700">Tidak ada invoice ditemukan</p>
              <p className="mt-1 text-sm text-slate-400">
                {filterStatus || filterPeriod
                  ? 'Coba ubah atau reset filter pencarian Anda.'
                  : 'Tagihan akan muncul saat kontrak aktif atau job penagihan dijalankan.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">No. Invoice</th>
                      {!isTenant && <th className="px-5 py-3.5">Penghuni & Kamar</th>}
                      <th className="px-5 py-3.5">Periode</th>
                      <th className="px-5 py-3.5">Jatuh Tempo</th>
                      <th className="px-5 py-3.5 text-right">Total Tagihan</th>
                      <th className="px-5 py-3.5 text-right">Sisa (Outstanding)</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-5 py-4 font-mono font-bold text-brand-navy">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(inv)}
                            className="hover:text-brand-teal text-left"
                          >
                            {inv.invoice_number}
                          </button>
                          <div className="text-[11px] font-sans font-normal text-slate-400">
                            {invoiceTypeLabel[inv.invoice_type] || inv.invoice_type}
                          </div>
                        </td>
                        {!isTenant && (
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-800">{inv.tenant_name || '-'}</div>
                            <div className="text-xs text-slate-400">Kamar {inv.room_number || '-'}</div>
                          </td>
                        )}
                        <td className="px-5 py-4 font-medium text-slate-600">
                          {formatPeriod(inv.billing_period)}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-600">
                          {formatDate(inv.due_at)}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-800">
                          {formatMoney(inv.total_minor, inv.currency)}
                        </td>
                        <td className="px-5 py-4 text-right font-extrabold text-brand-navy">
                          <span className={inv.outstanding_minor > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {formatMoney(inv.outstanding_minor, inv.currency)}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                              invoiceStatusTone[inv.status] || 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {invoiceStatusLabel[inv.status] || inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(inv)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                  <div>
                    Halaman {page} dari {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Jobs */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-brand-navy">Riwayat Eksekusi Job Billing</h2>
            <p className="text-xs text-slate-500">
              Semua eksekusi worker billing dijaga idempoten per run_key dan tercatat dalam audit trail.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kontrak Terlihat</th>
                    <th className="px-4 py-3">Invoice Dibuat</th>
                    <th className="px-4 py-3">Dilewati</th>
                    <th className="px-4 py-3">Waktu Mulai</th>
                    <th className="px-4 py-3">Catatan / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400">
                        Belum ada riwayat job billing.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {formatPeriod(job.billing_period)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              job.status === 'succeeded'
                                ? 'bg-emerald-100 text-emerald-800'
                                : job.status === 'skipped'
                                ? 'bg-slate-100 text-slate-600'
                                : job.status === 'running'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{job.contracts_seen}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">{job.invoices_created}</td>
                        <td className="px-4 py-3 font-semibold text-slate-500">{job.invoices_skipped}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(job.started_at)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate">
                          {job.error_summary || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Policy */}
      {activeTab === 'policy' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm max-w-3xl">
            <h2 className="text-lg font-bold text-brand-navy">Kebijakan Billing Properti</h2>
            <p className="mt-1 text-sm text-slate-500">
              Konfigurasi siklus penagihan, hari jatuh tempo, timezone, dan penanganan tanggal invalid.
            </p>

            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="policy-due-day" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Hari Jatuh Tempo (1 - 31)
                  </label>
                  <input
                    id="policy-due-day"
                    type="number"
                    min={1}
                    max={31}
                    value={policyForm.due_day ?? 1}
                    onChange={(e) => setPolicyForm({ ...policyForm, due_day: parseInt(e.target.value) || 1 })}
                    disabled={!canWrite}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-brand-teal focus:outline-none disabled:bg-slate-50"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Tanggal jatuh tempo akan secara otomatis di-clamp ke hari terakhir pada bulan pendek (cth: Feb 28/29).
                  </p>
                </div>

                <div>
                  <label htmlFor="policy-generate-days" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Generate Hari Sebelum Jatuh Tempo
                  </label>
                  <input
                    id="policy-generate-days"
                    type="number"
                    min={0}
                    max={60}
                    value={policyForm.generate_days_before ?? 7}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, generate_days_before: parseInt(e.target.value) || 0 })
                    }
                    disabled={!canWrite}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-brand-teal focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="policy-timezone" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Timezone Properti
                  </label>
                  <select
                    id="policy-timezone"
                    value={policyForm.timezone ?? 'Asia/Jakarta'}
                    onChange={(e) => setPolicyForm({ ...policyForm, timezone: e.target.value })}
                    disabled={!canWrite}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-brand-teal focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                    <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                    <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="policy-time" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                    Waktu Generate Otomatis
                  </label>
                  <input
                    id="policy-time"
                    type="time"
                    value={policyForm.generation_time ?? '00:15:00'}
                    onChange={(e) => setPolicyForm({ ...policyForm, generation_time: e.target.value })}
                    disabled={!canWrite}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-brand-teal focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policyForm.late_fee_enabled ?? false}
                    onChange={(e) => setPolicyForm({ ...policyForm, late_fee_enabled: e.target.checked })}
                    disabled={!canWrite}
                    className="h-4 w-4 rounded accent-brand-teal"
                  />
                  <span className="text-sm font-bold text-slate-800">Aktifkan Denda Keterlambatan</span>
                </label>

                {policyForm.late_fee_enabled && (
                  <div className="grid gap-4 sm:grid-cols-2 pt-2">
                    <div>
                      <label htmlFor="policy-late-grace" className="block text-xs font-semibold text-slate-500">Masa Tenggang (Grace Days)</label>
                      <input
                        id="policy-late-grace"
                        type="number"
                        min={0}
                        max={90}
                        value={policyForm.late_fee_grace_days ?? 0}
                        onChange={(e) =>
                          setPolicyForm({ ...policyForm, late_fee_grace_days: parseInt(e.target.value) || 0 })
                        }
                        disabled={!canWrite}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="policy-late-val" className="block text-xs font-semibold text-slate-500">Nominal Denda (IDR)</label>
                      <input
                        id="policy-late-val"
                        type="number"
                        min={0}
                        value={policyForm.late_fee_value_minor ?? 0}
                        onChange={(e) =>
                          setPolicyForm({ ...policyForm, late_fee_value_minor: parseInt(e.target.value) || 0 })
                        }
                        disabled={!canWrite}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {canWrite && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSavePolicy}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0c7668] disabled:opacity-50 transition"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Simpan Kebijakan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/75 p-6">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xl font-extrabold text-brand-navy">
                    {selectedInvoice.invoice_number}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                      invoiceStatusTone[selectedInvoice.status]
                    }`}
                  >
                    {invoiceStatusLabel[selectedInvoice.status]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                    {invoiceTypeLabel[selectedInvoice.invoice_type]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Periode {formatPeriod(selectedInvoice.billing_period)} · Jatuh tempo {formatDate(selectedInvoice.due_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {detailLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
                </div>
              ) : (
                <>
                  {/* Info Header */}
                  <div className="grid gap-4 sm:grid-cols-2 rounded-2xl bg-slate-50 p-4 text-xs">
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider">Penghuni</span>
                      <p className="mt-0.5 font-bold text-slate-800 text-sm">{selectedInvoice.tenant_name || '-'}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-400 uppercase tracking-wider">Kamar & Kontrak</span>
                      <p className="mt-0.5 font-semibold text-slate-800 text-sm">
                        Kamar {selectedInvoice.room_number || '-'} · ID {selectedInvoice.contract_id.slice(0, 8)}
                      </p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Rincian Line Item
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 font-bold uppercase text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-2.5">Item & Deskripsi</th>
                            <th className="px-4 py-2.5">Tipe</th>
                            <th className="px-4 py-2.5 text-right">Jumlah</th>
                            <th className="px-4 py-2.5 text-right">Nominal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                            selectedInvoice.items.map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800">{item.description}</div>
                                  {item.reason && (
                                    <div className="text-[11px] text-slate-500">Alasan: {item.reason}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                    {itemTypeLabel[item.item_type] || item.item_type}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-600">{item.quantity}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-800">
                                  {formatMoney(item.amount_minor, selectedInvoice.currency)}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-slate-400">
                                Tidak ada line item tercatat.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Financial Summary */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/75 p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Tagihan:</span>
                      <span className="font-semibold text-slate-800">
                        {formatMoney(selectedInvoice.total_minor, selectedInvoice.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Teralokasi / Terbayar:</span>
                      <span className="font-semibold text-emerald-600">
                        - {formatMoney(selectedInvoice.allocated_minor, selectedInvoice.currency)}
                      </span>
                    </div>
                    {selectedInvoice.credit_applied_minor > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Kredit Diterapkan:</span>
                        <span className="font-semibold text-emerald-600">
                          - {formatMoney(selectedInvoice.credit_applied_minor, selectedInvoice.currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold">
                      <span className="text-brand-navy">Sisa Tagihan (Outstanding):</span>
                      <span className={selectedInvoice.outstanding_minor > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {formatMoney(selectedInvoice.outstanding_minor, selectedInvoice.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Adjustments Section */}
                  {selectedInvoice.adjustments && selectedInvoice.adjustments.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Penyesuaian Terkait
                      </h3>
                      <div className="space-y-2">
                        {selectedInvoice.adjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-white text-xs"
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

                  {/* Audit Events Timeline */}
                  {selectedInvoice.events && selectedInvoice.events.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Histori & Audit Trail
                      </h3>
                      <div className="space-y-3 border-l-2 border-slate-200 pl-4 text-xs">
                        {selectedInvoice.events.map((evt) => (
                          <div key={evt.id} className="relative">
                            <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-teal" />
                            <div className="font-bold text-slate-800">
                              {evt.event_type.replace(/_/g, ' ')}
                            </div>
                            <div className="text-[11px] text-slate-400">{formatDate(evt.created_at)}</div>
                            {evt.reason && <div className="mt-0.5 text-slate-600">{evt.reason}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Staff Adjustment Button / Form */}
                  {!isTenant && canWrite && (
                    <div className="border-t border-slate-200 pt-4">
                      {!showAdjustmentForm ? (
                        <button
                          type="button"
                          onClick={() => setShowAdjustmentForm(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal transition"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Buat Penyesuaian (Adjustment)
                        </button>
                      ) : (
                        <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-teal-950 text-xs uppercase tracking-wider">
                              Form Penyesuaian Tagihan
                            </h4>
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
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor="adj-desc" className="block text-[11px] font-semibold text-slate-600">
                                Deskripsi Item
                              </label>
                              <input
                                id="adj-desc"
                                type="text"
                                placeholder="Cth: Keringanan denda atau Kompensasi AC"
                                value={adjustmentForm.description}
                                onChange={(e) =>
                                  setAdjustmentForm({ ...adjustmentForm, description: e.target.value })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                              />
                            </div>
                            <div>
                              <label htmlFor="adj-amount" className="block text-[11px] font-semibold text-slate-600">
                                Nominal (+ Tambah / - Kurang)
                              </label>
                              <input
                                id="adj-amount"
                                type="number"
                                placeholder="-50000"
                                value={adjustmentForm.amount_minor || ''}
                                onChange={(e) =>
                                  setAdjustmentForm({
                                    ...adjustmentForm,
                                    amount_minor: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                              />
                            </div>
                          </div>

                          <div>
                            <label htmlFor="adj-reason" className="block text-[11px] font-semibold text-slate-600">
                              Alasan Penyesuaian (Wajib Dicatat untuk Audit)
                            </label>
                            <input
                              id="adj-reason"
                              type="text"
                              placeholder="Cth: Kesepakatan renovasi kamar 2 hari"
                              value={adjustmentForm.reason}
                              onChange={(e) =>
                                setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800"
                            />
                          </div>

                          {/* Live Preview Box */}
                          {adjustmentPreviewData && (
                            <div className="rounded-xl border border-teal-200 bg-white p-3 space-y-1.5 text-xs">
                              <p className="font-bold text-teal-900">Preview Dampak Penyesuaian:</p>
                              <div className="flex justify-between text-slate-600">
                                <span>Outstanding Saat Ini:</span>
                                <span>{formatMoney(adjustmentPreviewData.current_outstanding_minor)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Nominal Penyesuaian:</span>
                                <span className={adjustmentPreviewData.adjustment_minor < 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                                  {formatMoney(adjustmentPreviewData.adjustment_minor)}
                                </span>
                              </div>
                              <div className="flex justify-between border-t border-slate-100 pt-1 font-extrabold text-brand-navy">
                                <span>Outstanding Setelah Penyesuaian:</span>
                                <span>{formatMoney(adjustmentPreviewData.combined_outstanding_minor)}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={handlePreviewAdjustment}
                              disabled={previewLoading || !adjustmentForm.amount_minor}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-teal disabled:opacity-50"
                            >
                              {previewLoading ? 'Menghitung...' : 'Preview Dampak'}
                            </button>
                            <button
                              type="button"
                              onClick={handleSubmitAdjustment}
                              disabled={busy || !adjustmentPreviewData}
                              className="rounded-lg bg-brand-teal px-4 py-1.5 text-xs font-bold text-white hover:bg-[#0c7668] disabled:opacity-50"
                            >
                              {busy ? 'Menyimpan...' : 'Terapkan Penyesuaian'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-100 bg-slate-50/75 p-4 flex justify-between items-center text-xs text-slate-500">
              <span className="font-mono">ID: {selectedInvoice.id}</span>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="rounded-xl bg-slate-200 px-4 py-2 font-bold text-slate-700 hover:bg-slate-300"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Invoices Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-brand-teal" />
                <h3 className="font-bold text-brand-navy text-lg">Generate Tagihan Rutin</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Eksekusi pembuatan invoice untuk seluruh kontrak aktif pada periode yang dipilih. Job bersifat idempoten
              sehingga invoice yang sudah ada tidak akan diduplikasi.
            </p>

            <div>
              <label htmlFor="gen-period" className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Pilih Periode Tagihan
              </label>
              <input
                id="gen-period"
                type="month"
                value={generatePeriod}
                onChange={(e) => setGeneratePeriod(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm text-slate-800 focus:border-brand-teal focus:outline-none"
              />
            </div>

            {generateResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-1 text-emerald-900">
                <p className="font-bold">Hasil Eksekusi Job:</p>
                <p>Status: {generateResult.status}</p>
                <p>Kontrak Terlihat: {generateResult.contracts_seen}</p>
                <p>Invoice Baru Dibuat: {generateResult.invoices_created}</p>
                <p>Invoice Dilewati: {generateResult.invoices_skipped}</p>
                {generateResult.error_summary && (
                  <p className="text-rose-600 font-semibold">{generateResult.error_summary}</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={busy || !generatePeriod}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:bg-[#0c7668] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Jalankan Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Meter Reading Modal */}
      {showMeterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-brand-teal" />
                <h3 className="font-bold text-brand-navy text-lg">Pencatatan Meter Utilitas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMeterModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label htmlFor="meter-contract-id" className="block font-bold text-slate-500 uppercase tracking-wider">Contract ID</label>
                <input
                  id="meter-contract-id"
                  type="text"
                  placeholder="ID kontrak penyewa"
                  value={meterForm.contract_id}
                  onChange={(e) => setMeterForm({ ...meterForm, contract_id: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="meter-type" className="block font-bold text-slate-500 uppercase tracking-wider">Tipe Utility</label>
                  <select
                    id="meter-type"
                    value={meterForm.utility_type}
                    onChange={(e) =>
                      setMeterForm({
                        ...meterForm,
                        utility_type: e.target.value as 'electricity' | 'water' | 'other',
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                  >
                    <option value="electricity">Listrik</option>
                    <option value="water">Air</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="meter-period" className="block font-bold text-slate-500 uppercase tracking-wider">Periode Tagihan</label>
                  <input
                    id="meter-period"
                    type="month"
                    value={meterForm.billing_period}
                    onChange={(e) => setMeterForm({ ...meterForm, billing_period: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="meter-prev" className="block font-bold text-slate-500 uppercase tracking-wider">Meter Lalu</label>
                  <input
                    id="meter-prev"
                    type="number"
                    step="0.01"
                    min={0}
                    value={meterForm.previous_value}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, previous_value: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="meter-curr" className="block font-bold text-slate-500 uppercase tracking-wider">Meter Kini</label>
                  <input
                    id="meter-curr"
                    type="number"
                    step="0.01"
                    min={0}
                    value={meterForm.current_value}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, current_value: parseFloat(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                  />
                </div>
                <div>
                  <label htmlFor="meter-unit-price" className="block font-bold text-slate-500 uppercase tracking-wider">Tarif per Unit</label>
                  <input
                    id="meter-unit-price"
                    type="number"
                    min={0}
                    value={meterForm.unit_price_minor}
                    onChange={(e) =>
                      setMeterForm({ ...meterForm, unit_price_minor: parseInt(e.target.value) || 0 })
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-slate-600">
                <span className="font-semibold">Estimasi Pemakaian: </span>
                <span className="font-bold text-slate-800">
                  {Math.max(0, meterForm.current_value - meterForm.previous_value).toFixed(2)} unit
                </span>
                {' · '}
                <span className="font-semibold">Total Biaya: </span>
                <span className="font-bold text-brand-teal">
                  {formatMoney(
                    Math.round(
                      Math.max(0, meterForm.current_value - meterForm.previous_value) * meterForm.unit_price_minor,
                    ),
                  )}
                </span>
              </div>

              <div>
                <label htmlFor="meter-notes" className="block font-bold text-slate-500 uppercase tracking-wider">Catatan</label>
                <input
                  id="meter-notes"
                  type="text"
                  placeholder="Catatan tambahan bila ada"
                  value={meterForm.notes}
                  onChange={(e) => setMeterForm({ ...meterForm, notes: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMeterModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRecordMeter}
                disabled={busy || !meterForm.contract_id}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:bg-[#0c7668] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan Meteran
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
