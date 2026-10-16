'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Unlock,
  Users,
  Wallet,
  X,
  Building,
} from 'lucide-react';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import {
  getFinancialDashboard,
  getReceivablesAging,
  listExpenses,
  createExpense,
  listPeriodClosures,
  closePeriod,
  reopenPeriod,
  listAdjustments,
  createAdjustment,
  approveAdjustment,
  createExportJob,
  listExportJobs,
  downloadExport,
} from '@/features/finance/api';
import type {
  Expense,
  ExpenseCategory,
  FinancialDashboardSummary,
  FinanceExportJob,
  FinancePeriodAdjustment,
  FinancePeriodClosure,
  ReceivablesAgingSummary,
} from '@/features/finance/types';
import {
  formatAgingBucket,
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
  formatPeriodStatus,
  formatAdjustmentStatus,
  formatReportTypeName,
} from '@/features/finance/format';

type TabKey = 'summary' | 'aging' | 'expenses' | 'closures' | 'exports';

export default function ReportsAndFinancePage() {
  const { activeProperty } = useActiveProperty();
  const { can, role } = useAuthorization();

  const propertyId = activeProperty?.id;

  // Selected period state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  // Computed period start and end
  const periodKey = useMemo(() => {
    return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth]);

  const periodStart = useMemo(() => {
    return `${periodKey}-01`;
  }, [periodKey]);

  const periodEnd = useMemo(() => {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    return `${periodKey}-${String(lastDay).padStart(2, '0')}`;
  }, [selectedYear, selectedMonth, periodKey]);

  // Data states
  const [dashboard, setDashboard] = useState<FinancialDashboardSummary | null>(null);
  const [aging, setAging] = useState<ReceivablesAgingSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [periodClosures, setPeriodClosures] = useState<FinancePeriodClosure[]>([]);
  const [adjustments, setAdjustments] = useState<FinancePeriodAdjustment[]>([]);
  const [exportJobs, setExportJobs] = useState<FinanceExportJob[]>([]);

  // Loading & notification states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states
  const [closeNotes, setCloseNotes] = useState('');
  const [adjustmentForm, setAdjustmentForm] = useState({
    adjustment_type: 'expense_adjustment',
    amount: '',
    reason: '',
  });
  const [exportForm, setExportForm] = useState({
    report_type: 'cash_flow',
    format: 'csv',
  });

  // Load all finance data for property & period
  const loadData = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [dashData, agingData, expData, closuresData, adjData, expJobsData] = await Promise.all([
        getFinancialDashboard(propertyId, periodStart, periodEnd),
        getReceivablesAging(propertyId),
        listExpenses(propertyId, { start_date: periodStart, end_date: periodEnd, page_size: 50 }),
        listPeriodClosures(propertyId),
        listAdjustments(propertyId),
        listExportJobs(propertyId),
      ]);

      setDashboard(dashData);
      setAging(agingData);
      setExpenses(expData.data);
      setPeriodClosures(closuresData);
      setAdjustments(adjData);
      setExportJobs(expJobsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data keuangan properti');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, periodStart, periodEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Period Close (AC 4)
  const handleClosePeriodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setModalSubmitting(true);
    setModalError(null);
    try {
      await closePeriod(propertyId, {
        period_key: periodKey,
        notes: closeNotes.trim(),
      });
      setIsClosePeriodModalOpen(false);
      setCloseNotes('');
      setSuccessMessage(`Periode ${periodKey} berhasil ditutup buku dan dilock untuk audit`);
      loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Gagal menutup periode buku');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Reopen Period
  const handleReopenPeriod = async () => {
    if (!propertyId) return;
    const reason = prompt(`Masukkan alasan audit pembukaan kembali periode ${periodKey}:`);
    if (!reason || !reason.trim()) return;

    try {
      await reopenPeriod(propertyId, periodKey, reason.trim());
      setSuccessMessage(`Periode ${periodKey} dibuka kembali dengan catatan audit`);
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal membuka kembali periode');
    }
  };

  // Handle Post-Closure Adjustment Submit (AC 4)
  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !dashboard?.period_closure?.id) return;
    setModalSubmitting(true);
    setModalError(null);

    const amountMinor = Math.round(Number(adjustmentForm.amount));
    if (isNaN(amountMinor)) {
      setModalError('Nominal penyesuaian harus berupa angka yang valid');
      setModalSubmitting(false);
      return;
    }

    try {
      await createAdjustment(propertyId, {
        period_close_id: dashboard.period_closure.id,
        adjustment_type: adjustmentForm.adjustment_type,
        amount_minor: amountMinor,
        reason: adjustmentForm.reason.trim(),
      });
      setIsAdjustmentModalOpen(false);
      setAdjustmentForm({ adjustment_type: 'expense_adjustment', amount: '', reason: '' });
      setSuccessMessage('Pengajuan penyesuaian pasca tutup buku berhasil diajukan dan menunggu approval');
      loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Gagal mengajukan penyesuaian');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Adjustment Approval/Rejection (AC 4)
  const handleApproveAdjustment = async (adjId: string, approved: boolean) => {
    if (!propertyId) return;
    let reason = '';
    if (!approved) {
      const input = prompt('Masukkan alasan penolakan penyesuaian audit:');
      if (input === null) return;
      reason = input.trim();
    }

    try {
      await approveAdjustment(propertyId, adjId, {
        approved,
        rejection_reason: reason,
        notes: approved ? 'Disetujui oleh otorisator' : `Ditolak: ${reason}`,
      });
      setSuccessMessage(approved ? 'Penyesuaian audit berhasil disetujui' : 'Penyesuaian audit ditolak');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses approval penyesuaian');
    }
  };

  // Handle Export Job Creation (AC 5)
  const handleCreateExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setModalSubmitting(true);
    setModalError(null);
    try {
      const job = await createExportJob(propertyId, {
        report_type: exportForm.report_type,
        period_start: periodStart,
        period_end: periodEnd,
        export_format: exportForm.format,
      });
      setIsExportModalOpen(false);
      setSuccessMessage(`Laporan ${formatReportTypeName(job.report_type)} berhasil diekspor (Total ${job.total_rows} baris). File siap diunduh.`);
      loadData();
      setActiveTab('exports');
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Gagal membuat file ekspor');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Handle Direct Download of Export Job (AC 5)
  const handleDownloadJob = async (job: FinanceExportJob) => {
    if (!propertyId) return;
    try {
      const blob = await downloadExport(propertyId, job.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = job.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal mengunduh file laporan');
    }
  };

  const isPeriodClosed = Boolean(dashboard?.is_period_closed);
  const periodClosure = dashboard?.period_closure;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
              Laporan & Rekonsiliasi Keuangan
            </h1>
            {isPeriodClosed ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                <Lock className="h-3 w-3" /> Periode Ditutup Buku
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                <Unlock className="h-3 w-3" /> Periode Aktif
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-brand-navy/60">
            Rekonsiliasi arus kas, umur piutang, titipan deposit, biaya operasional, dan tutup buku {activeProperty?.name}
          </p>
        </div>

        {/* Period Selector & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-sm">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg bg-transparent px-2 py-1 font-semibold text-slate-700 focus:outline-none"
            >
              {[
                'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg bg-transparent px-2 py-1 font-semibold text-slate-700 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {can(CAPABILITIES.FINANCE_EXPORT) && (
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsExportModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Ekspor CSV/PDF
            </button>
          )}

          {can(CAPABILITIES.FINANCE_CLOSE) && !isPeriodClosed && (
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsClosePeriodModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-600 transition"
            >
              <Lock className="h-4 w-4" />
              Tutup Periode Ini
            </button>
          )}

          {can(CAPABILITIES.FINANCE_ADJUST) && isPeriodClosed && (
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setIsAdjustmentModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-teal/90 transition"
            >
              <Plus className="h-4 w-4" />
              Ajukan Penyesuaian Audit
            </button>
          )}
        </div>
      </div>

      {/* Closed Period Alert Banner */}
      {isPeriodClosed && periodClosure && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Periode Keuangan {periodKey} Telah Ditutup Buku (Closed)</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Ditutup pada {new Date(periodClosure.closed_at).toLocaleString('id-ID')} oleh{' '}
                <span className="font-semibold">{periodClosure.closed_by_name || 'Owner/Finance'}</span>.
                Semua mutasi regular dibekukan untuk integritas audit. Mutasi tambahan wajib melalui approval penyesuaian (adjustment).
              </p>
              {periodClosure.notes && (
                <p className="text-xs text-amber-900/80 italic mt-1">&quot;{periodClosure.notes}&quot;</p>
              )}
            </div>
          </div>
          {can(CAPABILITIES.FINANCE_CLOSE) && (
            <button
              type="button"
              onClick={handleReopenPeriod}
              className="shrink-0 text-xs font-bold text-amber-700 underline hover:text-amber-900"
            >
              Buka Kembali Periode (Audit)
            </button>
          )}
        </div>
      )}

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-8 overflow-x-auto text-sm font-semibold">
          {[
            { key: 'summary' as TabKey, label: 'Ringkasan & Rekonsiliasi', icon: Layers },
            { key: 'aging' as TabKey, label: 'Aging Piutang', count: aging?.invoices.length, icon: Clock },
            { key: 'expenses' as TabKey, label: 'Beban & Pengeluaran', count: expenses.length, icon: Wallet },
            { key: 'closures' as TabKey, label: 'Tutup Periode & Adjustment', count: adjustments.length, icon: ShieldCheck },
            { key: 'exports' as TabKey, label: 'Ekspor & Unduhan Laporan', count: exportJobs.length, icon: Download },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 border-b-2 py-3.5 transition whitespace-nowrap ${
                  isActive
                    ? 'border-brand-teal text-brand-teal'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: RINGKASAN & REKONSILIASI */}
      {activeTab === 'summary' && dashboard && (
        <div className="space-y-6">
          {/* Executive Reconciliation Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* 1. Cash Received (AC 2) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kas Masuk Riil (Verified)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <ArrowDownRight className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-emerald-700">{formatCurrency(dashboard.cash_received_minor)}</p>
              <div className="mt-1 text-xs text-slate-400">
                <span>Hanya pembayaran terverifikasi. </span>
                {dashboard.pending_payments_minor > 0 && (
                  <span className="font-semibold text-amber-600">
                    Pending {formatCurrency(dashboard.pending_payments_minor)} diisolasi.
                  </span>
                )}
              </div>
            </div>

            {/* 2. Deposit Liability (AC 3) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Titipan Deposit (Liabilitas)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-purple-700">{formatCurrency(dashboard.deposit_liability_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Kewajiban titipan penyewa aktif (Bukan pendapatan)</p>
            </div>

            {/* 3. Billed Revenue (Accrual) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pendapatan Terbiling (Akrual)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <FileText className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-blue-700">{formatCurrency(dashboard.billed_revenue_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Total invoice sewa & utilitas periode ini</p>
            </div>

            {/* 4. Operating Expenses */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pengeluaran Operasional</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-rose-700">{formatCurrency(dashboard.operating_expenses_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Total beban approved & dibayar</p>
            </div>

            {/* 5. NOI Basis Kas */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">NOI (Basis Kas)</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-brand-teal">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
              <p className={`mt-3 text-2xl font-bold ${dashboard.net_operating_income_minor >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>
                {formatCurrency(dashboard.net_operating_income_minor)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Kas Masuk Riil - Pengeluaran Kas</p>
            </div>

            {/* 6. Total Receivables */}
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Piutang Tertunggak</span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Clock className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-amber-700">{formatCurrency(dashboard.total_receivable_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Tagihan invoice yang belum terbayar</p>
            </div>
          </div>

          {/* Comparative Reconciliation Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Reconciliation Statement Table (AC 1, AC 2, AC 3) */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Tabel Rekonsiliasi Usaha (Basis Kas vs Akrual)
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Membedakan secara ketat arus kas riil, pendapatan tertagih, liabilitas deposit, dan beban usaha.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Komponen Usaha</th>
                      <th className="py-2.5 px-3 text-right">Basis Kas (Riil)</th>
                      <th className="py-2.5 px-3 text-right">Basis Akrual (Billed)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-2.5 px-3 font-medium">Penerimaan / Tagihan Sewa & Utilitas</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{formatCurrency(dashboard.cash_received_minor)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-700">{formatCurrency(dashboard.billed_revenue_minor)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-xs text-slate-500 pl-6">
                        - Pembayaran Pending (Unverified)
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-400">
                        {dashboard.pending_payments_minor > 0 ? `(${formatCurrency(dashboard.pending_payments_minor)} diisolasi)` : 'Rp 0'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-xs text-slate-400">-</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium">Beban Pengeluaran Operasional</td>
                      <td className="py-2.5 px-3 text-right text-rose-700">({formatCurrency(dashboard.operating_expenses_minor)})</td>
                      <td className="py-2.5 px-3 text-right text-rose-700">({formatCurrency(dashboard.operating_expenses_minor)})</td>
                    </tr>
                    <tr className="bg-slate-50/70 font-bold">
                      <td className="py-3 px-3">Net Operating Income (Laba Bersih)</td>
                      <td className="py-3 px-3 text-right text-teal-800">{formatCurrency(dashboard.net_operating_income_minor)}</td>
                      <td className="py-3 px-3 text-right text-teal-800">{formatCurrency(dashboard.accrual_net_income_minor)}</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-purple-900">
                        Titipan Jaminan / Deposit (Liabilitas Neraca)
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-purple-700" colSpan={2}>
                        {formatCurrency(dashboard.deposit_liability_minor)} (Tidak diakui sebagai pendapatan)
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-amber-900">
                        Sisa Piutang Berjalan (Belum Lunas)
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-700" colSpan={2}>
                        {formatCurrency(dashboard.total_receivable_minor)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses by Category Breakdown */}
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Distribusi Beban Pengeluaran per Kategori
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Rincian alokasi biaya perawatan, listrik, wifi, kebersihan, dan perlengkapan.
              </p>

              {dashboard.expenses_by_category.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                  Tidak ada catatan pengeluaran pada periode ini.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {dashboard.expenses_by_category.map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">{cat.category_label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">({cat.count} transaksi)</span>
                          <span className="font-bold text-slate-900">{formatCurrency(cat.total_minor)}</span>
                          <span className="font-semibold text-brand-teal">{cat.percentage}%</span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-teal transition-all duration-300"
                          style={{ width: `${Math.min(100, cat.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Occupancy and Potential Revenue Impact */}
          {dashboard.occupancy_stats && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Performa Okupansi & Potensi Omset</h2>
                  <p className="text-xs text-slate-500">Tingkat hunian kamar dan realisasi sewa kos</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-brand-teal">
                  <Users className="h-3.5 w-3.5" />
                  <span>Okupansi {dashboard.occupancy_stats.occupancy_rate}%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-center">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 uppercase">Total Kamar</p>
                  <p className="text-xl font-bold text-slate-800 mt-1">{dashboard.occupancy_stats.total_rooms}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 uppercase">Terisi (Occupied)</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{dashboard.occupancy_stats.occupied_rooms}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 uppercase">Potensi Omset Bulanan</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {formatCurrency(dashboard.occupancy_stats.potential_monthly_revenue_minor)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500 uppercase">Realisasi Kamar Terisi</p>
                  <p className="text-xl font-bold text-brand-teal mt-1">
                    {formatCurrency(dashboard.occupancy_stats.actual_monthly_revenue_minor)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AGING PIUTANG */}
      {activeTab === 'aging' && aging && (
        <div className="space-y-6">
          {/* Aging Summary Buckets */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-emerald-700">Lancar (0 - 30 Hari)</span>
              <p className="mt-2 text-2xl font-bold text-emerald-800">{formatCurrency(aging.current_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Jatuh tempo wajar</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-amber-700">31 - 60 Hari</span>
              <p className="mt-2 text-2xl font-bold text-amber-800">{formatCurrency(aging.due_31_to_60_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Terlambat 1 - 2 bulan</p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-orange-700">61 - 90 Hari</span>
              <p className="mt-2 text-2xl font-bold text-orange-800">{formatCurrency(aging.due_61_to_90_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Terlambat 2 - 3 bulan</p>
            </div>

            <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-rose-700">&gt; 90 Hari (Macet)</span>
              <p className="mt-2 text-2xl font-bold text-rose-800">{formatCurrency(aging.overdue_90_plus_minor)}</p>
              <p className="mt-1 text-xs text-slate-400">Perlu penagihan intensif</p>
            </div>
          </div>

          {/* Aging Invoices Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Daftar Tagihan Belum Lunas</h2>
                <p className="text-xs text-slate-500">Total piutang: {formatCurrency(aging.total_outstanding_minor)}</p>
              </div>
            </div>

            {aging.invoices.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-400">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
                <p className="font-semibold text-slate-700">Semua Tagihan Tertagih Lunas!</p>
                <p className="text-xs mt-0.5">Tidak ada invoice tertunggak pada properti ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Penghuni</th>
                      <th className="py-3 px-4">Kamar</th>
                      <th className="py-3 px-4">Jatuh Tempo</th>
                      <th className="py-3 px-4 text-center">Keterlambatan</th>
                      <th className="py-3 px-4 text-center">Bucket Umur</th>
                      <th className="py-3 px-4 text-right">Total Tagihan</th>
                      <th className="py-3 px-4 text-right">Sisa Piutang</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {aging.invoices.map((inv) => {
                      const b = formatAgingBucket(inv.aging_bucket);
                      return (
                        <tr key={inv.invoice_id} className="transition hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">{inv.invoice_number}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{inv.tenant_name}</td>
                          <td className="py-3 px-4">{inv.room_number}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {new Date(inv.due_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {inv.days_past_due > 0 ? (
                              <span className="font-semibold text-rose-600">{inv.days_past_due} hari</span>
                            ) : (
                              <span className="text-slate-400">Belum lewat</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${b.badge}`}>
                              {b.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">{formatCurrency(inv.total_minor)}</td>
                          <td className="py-3 px-4 text-right font-bold text-rose-700">
                            {formatCurrency(inv.outstanding_minor)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: BEBAN PENGELUARAN (EXPENSES TAB) */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Catatan Pengeluaran Periode {periodKey}
              </h2>
              <p className="text-xs text-slate-500">
                Semua pengeluaran yang jatuh pada bulan ini
              </p>
            </div>
            {can(CAPABILITIES.EXPENSE_WRITE) && (
              <a
                href="/expenses"
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-teal/90 transition"
              >
                <Plus className="h-4 w-4" />
                Buka Pengelola Biaya Penuh
              </a>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {expenses.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-400">
                <Wallet className="h-10 w-10 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Belum Ada Pengeluaran</p>
                <p className="text-xs mt-0.5">Tidak ada catatan biaya pada periode ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Tanggal & No</th>
                      <th className="py-3 px-4">Judul</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {expenses.map((e) => {
                      const cat = formatExpenseCategory(e.category);
                      const st = formatExpenseStatus(e.status);
                      return (
                        <tr key={e.id} className="transition hover:bg-slate-50/60">
                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-900">{e.expense_date}</span>
                            <span className="block text-xs font-mono text-slate-400">{e.expense_number}</span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{e.title}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${cat.badgeBg} ${cat.badgeText}`}>
                              {cat.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{e.vendor_name || 'Internal'}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">{formatCurrency(e.amount_minor)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.text} ${st.border}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TUTUP PERIODE & ADJUSTMENT (AC 4) */}
      {activeTab === 'closures' && (
        <div className="space-y-6">
          {/* Post-Closure Adjustments Table (AC 4) */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Penyesuaian Pasca Tutup Buku (Adjustments)
                </h2>
                <p className="text-xs text-slate-500">
                  Setiap koreksi atau penambahan angka setelah periode ditutup buku wajib diapprove dan tercatat di audit trail (AC 4).
                </p>
              </div>

              {can(CAPABILITIES.FINANCE_ADJUST) && isPeriodClosed && (
                <button
                  type="button"
                  onClick={() => {
                    setModalError(null);
                    setIsAdjustmentModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-teal/90 transition"
                >
                  <Plus className="h-4 w-4" />
                  Ajukan Penyesuaian
                </button>
              )}
            </div>

            {adjustments.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center p-6 text-slate-400">
                <ShieldCheck className="h-10 w-10 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Belum Ada Penyesuaian</p>
                <p className="text-xs mt-0.5">Semua buku tertutup rapi tanpa koreksi pasca tutup periode.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">No Adjustment</th>
                      <th className="py-3 px-4">Tipe Koreksi</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                      <th className="py-3 px-4">Alasan & Justifikasi</th>
                      <th className="py-3 px-4">Pemohon</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Aksi Otorisasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {adjustments.map((adj) => {
                      const st = formatAdjustmentStatus(adj.status);
                      return (
                        <tr key={adj.id} className="transition hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-mono font-medium text-slate-800">{adj.adjustment_number}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{adj.adjustment_type}</td>
                          <td className={`py-3 px-4 text-right font-bold ${adj.amount_minor >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                            {formatCurrency(adj.amount_minor)}
                          </td>
                          <td className="py-3 px-4 max-w-xs text-xs text-slate-600 line-clamp-2">{adj.reason}</td>
                          <td className="py-3 px-4 text-xs text-slate-600">{adj.requested_by_name || 'Staff'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {can(CAPABILITIES.FINANCE_CLOSE) && adj.status === 'pending' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleApproveAdjustment(adj.id, true)}
                                  className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproveAdjustment(adj.id, false)}
                                  className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                                >
                                  Tolak
                                </button>
                              </div>
                            )}
                            {adj.status !== 'pending' && (
                              <span className="text-xs text-slate-400">
                                {adj.approved_by_name ? `Diproses oleh ${adj.approved_by_name}` : 'Selesai'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Period Closures History */}
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">Riwayat Tutup Buku Bulanan (Period Closures)</h2>
              <p className="text-xs text-slate-500">Daftar periode yang telah difinalisasi</p>
            </div>

            {periodClosures.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                Belum ada periode yang pernah ditutup buku.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Periode</th>
                      <th className="py-3 px-4">Rentang Tanggal</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Ditutup Oleh</th>
                      <th className="py-3 px-4">Waktu Penutupan</th>
                      <th className="py-3 px-4">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {periodClosures.map((c) => {
                      const st = formatPeriodStatus(c.status);
                      return (
                        <tr key={c.id}>
                          <td className="py-3 px-4 font-bold text-slate-900">{c.period_key}</td>
                          <td className="py-3 px-4 text-xs text-slate-600">{c.period_start} s/d {c.period_end}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${st.badge}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{c.closed_by_name || 'Owner/Finance'}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {new Date(c.closed_at).toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 max-w-xs">{c.notes || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: EKSPOR & UNDUHAN LAPORAN (AC 5) */}
      {activeTab === 'exports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ekspor Laporan & Unduhan Terpusat
              </h2>
              <p className="text-xs text-slate-500">
                Ekspor laporan volume besar didesain dengan pagination & background checksum SHA256 (AC 5)
              </p>
            </div>

            {can(CAPABILITIES.FINANCE_EXPORT) && (
              <button
                type="button"
                onClick={() => {
                  setModalError(null);
                  setIsExportModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-teal/90 transition"
              >
                <Plus className="h-4 w-4" />
                Generate Ekspor Baru
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            {exportJobs.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center p-6 text-slate-400">
                <FileSpreadsheet className="h-10 w-10 text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Belum Ada File Ekspor</p>
                <p className="text-xs mt-0.5">Klik tombol &apos;Generate Ekspor Baru&apos; untuk membuat laporan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Nama File Laporan</th>
                      <th className="py-3 px-4">Jenis Laporan</th>
                      <th className="py-3 px-4">Periode</th>
                      <th className="py-3 px-4 text-center">Jumlah Baris</th>
                      <th className="py-3 px-4 font-mono text-xs">Checksum Integritas (SHA256)</th>
                      <th className="py-3 px-4">Dibuat Oleh</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {exportJobs.map((job) => (
                      <tr key={job.id} className="transition hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-medium text-slate-900 flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>{job.file_name}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          {formatReportTypeName(job.report_type)}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {job.period_start} s/d {job.period_end}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">
                          {job.total_rows} baris
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500 max-w-xs truncate" title={job.checksum_sha256}>
                          {job.checksum_sha256.slice(0, 16)}...
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">{job.requested_by_name || 'Staff'}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadJob(job)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-teal/10 px-3 py-1.5 text-xs font-bold text-brand-teal hover:bg-brand-teal/20 transition"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Unduh CSV
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: TUTUP PERIODE BUKU (AC 4) */}
      {isClosePeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Tutup Buku Periode {periodKey}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsClosePeriodModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleClosePeriodSubmit} className="mt-4 space-y-4 text-sm">
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-bold">Perhatian Penting:</p>
                <p>
                  Setelah periode ditutup, seluruh transaksi beban dan pendapatan pada bulan {periodKey} akan dibekukan untuk audit. Penyesuaian selanjutnya wajib melalui proses form Adjustment (AC 4).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Catatan Tutup Buku & Opini Pemeriksa
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Rekonsiliasi fisik bank dan opname kas selesai. Semua invoice sudah dialokasikan."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsClosePeriodModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {modalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Konfirmasi Tutup Periode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUKAN PENYESUAIAN PASCA TUTUP BUKU (AC 4) */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-brand-teal" />
                <h2 className="text-lg font-bold text-slate-900">Penyesuaian Pasca Tutup Buku</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAdjustmentSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Tipe Penyesuaian *
                </label>
                <select
                  value={adjustmentForm.adjustment_type}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustment_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                >
                  <option value="expense_adjustment">Penyesuaian Biaya (Expense Adjustment)</option>
                  <option value="revenue_correction">Koreksi Pendapatan (Revenue Correction)</option>
                  <option value="deposit_adjustment">Penyesuaian Deposit (Deposit Adjustment)</option>
                  <option value="write_off">Penghapusan Piutang Tak Tertagih (Write Off)</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Nominal Penyesuaian (IDR) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Gunakan tanda minus (-) bila mengurangi"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Alasan Audit & Justifikasi *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Jelaskan nomor kwitansi, latar belakang keterlambatan, atau referensi faktur..."
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-teal/90 disabled:opacity-50"
                >
                  {modalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Kirim Pengajuan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GENERATE EKSPOR LAPORAN (AC 5) */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Ekspor Laporan Keuangan</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateExportSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Jenis Laporan *
                </label>
                <select
                  value={exportForm.report_type}
                  onChange={(e) => setExportForm({ ...exportForm, report_type: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none font-medium text-slate-800"
                >
                  <option value="cash_flow">Laporan Arus Kas (Cash Flow)</option>
                  <option value="receivables_aging">Laporan Umur Piutang (Receivables Aging)</option>
                  <option value="expense_summary">Ringkasan Beban & Pengeluaran (Expense Summary)</option>
                  <option value="income_statement">Laba Rugi Operasional (Income Statement)</option>
                  <option value="full_ledger">Buku Besar Lengkap (Full Ledger)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Format Berkas
                </label>
                <select
                  value={exportForm.format}
                  onChange={(e) => setExportForm({ ...exportForm, format: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                >
                  <option value="csv">CSV (Dapat Dibuka di Excel / Google Sheets)</option>
                </select>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Rentang Periode Laporan:</p>
                <p>{periodStart} s/d {periodEnd} ({periodKey})</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  File laporan akan digenerate dengan checksum SHA256 untuk audit akuntan.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {modalSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Download & Generate CSV
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
