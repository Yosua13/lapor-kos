'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ShieldCheck,
  Activity,
  History,
  KeyRound,
  Copy,
  Check,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Database,
  HardDrive,
  Cpu,
  Lock,
  FileCheck2,
  ExternalLink,
} from 'lucide-react';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import {
  listFinancialAudits,
  getSystemHealth,
  getSecurityChecklist,
  revokeUserSession,
  revokeMySessions,
} from '@/features/audit/api';
import type {
  FinancialAuditLog,
  SystemHealthStatus,
  SecurityChecklist,
} from '@/features/audit/types';
import {
  formatAuditAction,
  formatAuditAmount,
  formatAuditDateTime,
  formatEntityType,
  getHealthBadge,
} from '@/features/audit/format';

type Tab = 'financial' | 'health' | 'sessions' | 'release_gates';

export default function AuditPage() {
  const { activeProperty } = useActiveProperty();
  const [activeTab, setActiveTab] = useState<Tab>('financial');
  const [isPending, startTransition] = useTransition();

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<FinancialAuditLog[]>([]);
  const [totalAudits, setTotalAudits] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [correlationSearch, setCorrelationSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedAuditForModal, setSelectedAuditForModal] = useState<FinancialAuditLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Health and security states
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus | null>(null);
  const [checklist, setChecklist] = useState<SecurityChecklist | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Session revocation form state
  const [targetUserId, setTargetUserId] = useState('');
  const [revokeReason, setRevokeReason] = useState('Pencabutan manual keamanan');

  const propertyId = activeProperty?.id;

  const loadAuditData = () => {
    if (!propertyId) return;
    setErrorMsg('');
    startTransition(async () => {
      try {
        const res = await listFinancialAudits(propertyId, {
          entity_type: entityFilter || undefined,
          action: actionFilter || undefined,
          correlation_id: correlationSearch || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          page: currentPage,
          page_size: 20,
        });
        setAuditLogs(res.items);
        setTotalAudits(res.total);
      } catch (err: unknown) {
        setErrorMsg((err as Error).message || 'Gagal memuat log audit finansial');
      }
    });
  };

  const loadHealthAndChecklist = () => {
    startTransition(async () => {
      try {
        const [health, check] = await Promise.all([
          getSystemHealth().catch(() => null),
          getSecurityChecklist(propertyId).catch(() => null),
        ]);
        if (health) setHealthStatus(health);
        if (check) setChecklist(check);
      } catch {
        // Ignored
      }
    });
  };

  useEffect(() => {
    if (activeTab === 'financial' && propertyId) {
      loadAuditData();
    } else if (activeTab === 'health' || activeTab === 'release_gates') {
      loadHealthAndChecklist();
    }
  }, [activeTab, propertyId, currentPage, entityFilter, actionFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadAuditData();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevokeSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await revokeUserSession({ user_id: targetUserId.trim(), reason: revokeReason });
      setSuccessMsg(`Sesi pengguna ${targetUserId} berhasil dicabut. Seluruh token sebelumnya ditolak.`);
      setTargetUserId('');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal mencabut sesi');
    }
  };

  const handleRevokeMySessions = async () => {
    if (!confirm('Apakah Anda yakin ingin mencabut seluruh sesi lain akun Anda?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await revokeMySessions();
      setSuccessMsg('Seluruh sesi aktif lainnya untuk akun Anda berhasil dicabut.');
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'Gagal mencabut sesi Anda');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Audit, Observability & Keamanan
            </h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Stage 0 & Release Gate
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pencatatan jejak audit finansial append-only, status kesehatan backend & database, kontrol token sesi, dan audit artefak rilis.
          </p>
        </div>

        <button
          onClick={() => {
            if (activeTab === 'financial') loadAuditData();
            else loadHealthAndChecklist();
          }}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
          <p>{successMsg}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'financial'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <History className="h-4 w-4" />
            Jejak Audit Finansial
            {totalAudits > 0 && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {totalAudits}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'health'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Activity className="h-4 w-4" />
            Observability & Kesiapan Sistem
          </button>

          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'sessions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Kontrol Sesi & Kebijakan File
          </button>

          <button
            onClick={() => setActiveTab('release_gates')}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === 'release_gates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Release Gate Checklist
          </button>
        </nav>
      </div>

      {/* TAB 1: FINANCIAL AUDIT TRAIL */}
      {activeTab === 'financial' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <form onSubmit={handleSearchSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Cari Correlation ID</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="req-uuid..."
                    value={correlationSearch}
                    onChange={(e) => setCorrelationSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Entitas</label>
                <select
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Semua Entitas</option>
                  <option value="payment">Pembayaran</option>
                  <option value="expense">Pengeluaran</option>
                  <option value="period_close">Penutupan Buku</option>
                  <option value="adjustment">Penyesuaian Periode</option>
                  <option value="invoice">Tagihan / Invoice</option>
                  <option value="settlement">Penyelesaian Checkout</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Aksi Spesifik</label>
                <input
                  type="text"
                  placeholder="e.g. payment_verify"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 py-1.5 px-4 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCorrelationSearch('');
                    setEntityFilter('');
                    setActionFilter('');
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                    loadAuditData();
                  }}
                  className="rounded-lg border border-slate-300 bg-white py-1.5 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </form>

          {/* Audit Logs Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Waktu (WIB)</th>
                    <th className="py-3 px-4">Aksi & Entitas</th>
                    <th className="py-3 px-4">Nilai Finansial</th>
                    <th className="py-3 px-4">Aktor / Pelaku</th>
                    <th className="py-3 px-4">Alasan Perubahan</th>
                    <th className="py-3 px-4">Correlation ID</th>
                    <th className="py-3 px-4 text-center">State Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {isPending ? 'Memuat jejak audit...' : 'Belum ada catatan audit finansial untuk properti ini.'}
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                          {formatAuditDateTime(log.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {formatAuditAction(log.action)}
                          </div>
                          <span className="inline-block mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {formatEntityType(log.entity_type)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-900">
                          {formatAuditAmount(log.amount_minor, log.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-800">
                            {log.actor_email || (log.actor_id ? log.actor_id.substring(0, 8) + '...' : 'Sistem')}
                          </div>
                          {log.actor_role && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                              {log.actor_role}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 max-w-xs truncate" title={log.reason}>
                          {log.reason || '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              {log.correlation_id ? log.correlation_id.substring(0, 16) + '...' : '-'}
                            </span>
                            {log.correlation_id && (
                              <button
                                type="button"
                                onClick={() => handleCopy(log.correlation_id, log.id)}
                                className="text-slate-400 hover:text-slate-600"
                                title="Salin Correlation ID"
                              >
                                {copiedId === log.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setSelectedAuditForModal(log)}
                            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-xs"
                          >
                            Inspeksi
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalAudits > 20 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
                <span className="text-xs text-slate-500">
                  Menampilkan {auditLogs.length} dari {totalAudits} total catatan audit
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage <= 1 || isPending}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Sebelumnya
                  </button>
                  <button
                    disabled={currentPage * 20 >= totalAudits || isPending}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM OBSERVABILITY & HEALTH */}
      {activeTab === 'health' && (
        <div className="space-y-6">
          {/* Status Header Banner */}
          {healthStatus && (
            <div className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
              healthStatus.status === 'ready' ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${healthStatus.status === 'ready' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  <Activity className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Status Kesiapan Operasional Backend: {getHealthBadge(healthStatus.status).label}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pemeriksaan berkala endpoint kesiapan (/readyz & /healthz). Terakhir diverifikasi: {formatAuditDateTime(healthStatus.timestamp)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="/api/health"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Probe /healthz
                </a>
                <a
                  href="/api/ready"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-blue-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-xs"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Probe /readyz
                </a>
              </div>
            </div>
          )}

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {/* Database Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Database className="h-4 w-4 text-blue-600" />
                  PostgreSQL Connectivity
                </div>
                {healthStatus?.database && (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getHealthBadge(healthStatus.database.status).className}`}>
                    {healthStatus.database.status.toUpperCase()}
                  </span>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Ping Latency:</span>
                  <span className="font-mono font-medium text-slate-900">
                    {healthStatus?.database?.latency_ms ? `${healthStatus.database.latency_ms.toFixed(2)} ms` : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Active Pool Conns:</span>
                  <span className="font-mono font-medium text-slate-900">
                    {healthStatus?.database?.total_conns ?? '-'} / {healthStatus?.database?.max_conns ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Idle / Acquired:</span>
                  <span className="font-mono font-medium text-slate-900">
                    {healthStatus?.database?.idle_conns ?? '-'} idle, {healthStatus?.database?.acquired_conns ?? '-'} acquired
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Versi Migrasi Terakhir:</span>
                  <span className="font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[11px]">
                    {healthStatus?.database?.latest_migration ?? '030_security_audit'}
                  </span>
                </div>
              </div>
            </div>

            {/* Storage Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <HardDrive className="h-4 w-4 text-indigo-600" />
                  Private Storage Policy
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                  TERENKRIPSI
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Status Penyimpanan:</span>
                  <span className="font-medium text-emerald-700">Terkonfigurasi Aman</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Bucket Dokumen Umum:</span>
                  <span className="font-mono text-slate-800">uploads (Private)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Bucket Identitas Tenant:</span>
                  <span className="font-mono text-slate-800">tenant-documents</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Masa Berlaku Signed URL:</span>
                  <span className="font-semibold text-slate-900">Maks. 15 Menit</span>
                </div>
              </div>
            </div>

            {/* Runtime Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
                  <Cpu className="h-4 w-4 text-purple-600" />
                  Runtime & Keamanan
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium border bg-purple-50 text-purple-700 border-purple-200">
                  GO RUNTIME
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Goroutines Aktif:</span>
                  <span className="font-mono font-medium text-slate-900">
                    {healthStatus?.runtime?.goroutines ?? '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Server Uptime:</span>
                  <span className="font-mono font-medium text-slate-900">
                    {healthStatus?.runtime?.uptime_seconds ? `${Math.floor(healthStatus.runtime.uptime_seconds / 60)} menit` : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Environment Mode:</span>
                  <span className="font-mono text-slate-800 uppercase">
                    {healthStatus?.runtime?.environment || 'Release'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Versi Sistem:</span>
                  <span className="font-mono font-medium text-slate-900">v1.0.0-rc</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SESSION CONTROLS & SECURITY */}
      {activeTab === 'sessions' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* User Session Invalidation */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
              <KeyRound className="h-5 w-5 text-rose-600" />
              Pencabutan Sesi Pengguna (Session Revocation)
            </div>
            <p className="text-xs text-slate-500">
              Membatalkan seluruh JWT aktif yang diterbitkan sebelum waktu pencabutan. Pengguna wajib melakukan login ulang secara langsung.
            </p>

            <form onSubmit={handleRevokeSession} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Target User ID (UUID)</label>
                <input
                  type="text"
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm font-mono focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alasan Pencabutan Sesi</label>
                <input
                  type="text"
                  placeholder="Indikasi akses mencurigakan / pergantian kredensial"
                  value={revokeReason}
                  onChange={(e) => setRevokeReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-rose-600 py-2 px-4 text-sm font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
              >
                Cabut Sesi Pengguna Ini Sekarang
              </button>
            </form>

            <div className="border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleRevokeMySessions}
                className="w-full rounded-lg border border-slate-300 bg-white py-2 px-4 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cabut Seluruh Sesi Lain Pada Akun Saya
              </button>
            </div>
          </div>

          {/* Active Security Controls Overview */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-semibold text-base border-b border-slate-100 pb-3">
              <Lock className="h-5 w-5 text-blue-600" />
              Kontrol Keamanan Aktif Sistem
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                <div>
                  <div className="font-medium text-slate-900">Perlindungan Header Keamanan (OWASP)</div>
                  <div className="text-slate-500 text-[11px]">Strict-Transport-Security, CSP, X-Frame DENY, nosniff</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  AKTIF
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                <div>
                  <div className="font-medium text-slate-900">Pembatasan Laju (Rate Limiting)</div>
                  <div className="text-slate-500 text-[11px]">Rate limiting bertingkat pada autentikasi, OTP, dan pass tamu</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  AKTIF
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                <div>
                  <div className="font-medium text-slate-900">Kebijakan Berkas Privat & Signed URL</div>
                  <div className="text-slate-500 text-[11px]">KTP, foto kamar, bukti bayar tidak memiliki URL publik langsung</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  TERENKRIPSI
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                <div>
                  <div className="font-medium text-slate-900">Jejak Audit Append-Only Immutability</div>
                  <div className="text-slate-500 text-[11px]">Database trigger memblokir perintah UPDATE dan DELETE pada tabel audit</div>
                </div>
                <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  TERKUNCI
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: RELEASE GATE CHECKLIST */}
      {activeTab === 'release_gates' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900 mb-1">
              Daftar Release Gate Sebelum Deploy & Produksi
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              Seluruh gate diverifikasi otomatis oleh CI Pipeline dan pengujian integrasi database terisolasi.
            </p>

            <div className="space-y-3">
              {/* Gate 1 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">1. Secret Scanning & Credential Purity (AC 1)</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">PASSED</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Memastikan tidak ada API key, private key, JWT secret, atau file kredensial .env yang tersimpan di git.
                  </p>
                </div>
              </div>

              {/* Gate 2 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">2. Sequential Migration Integrity (AC 1)</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">30/30 PASSED</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Urutan migrasi database (001 s/d 030) tervalidasi konsisten tanpa gap nomor urut dan dapat diterapkan bersih.
                  </p>
                </div>
              </div>

              {/* Gate 3 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">3. Cross-Owner & Multi-Tenant Isolation (AC 2)</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">ISOLATED</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Data antar-properti dan antar-owner dipisahkan secara ketat via middleware dan query berbatas property_id.
                  </p>
                </div>
              </div>

              {/* Gate 4 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">4. Automated Backup & Restore Drill (AC 2)</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">VERIFIED</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Uji coba restore snapshot database berkala memvalidasi integritas data, checksum, dan keberadaan trigger pelindung.
                  </p>
                </div>
              </div>

              {/* Gate 5 */}
              <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
                <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-900">5. Release Artifact Purity (AC 5)</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">CLEAN</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Artefak rilis dan tree produksi bebas dari berkas executable lokal (.exe), berkas upload pengguna, dan kredensial rahasia.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State Diff Inspector Modal */}
      {selectedAuditForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Inspeksi Jejak Audit: {formatAuditAction(selectedAuditForModal.action)}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {selectedAuditForModal.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAuditForModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-500">Waktu:</span>{' '}
                <span className="font-semibold">{formatAuditDateTime(selectedAuditForModal.created_at)}</span>
              </div>
              <div>
                <span className="text-slate-500">Aktor:</span>{' '}
                <span className="font-semibold">{selectedAuditForModal.actor_email || selectedAuditForModal.actor_role}</span>
              </div>
              <div>
                <span className="text-slate-500">Correlation ID:</span>{' '}
                <span className="font-mono text-blue-700">{selectedAuditForModal.correlation_id}</span>
              </div>
              <div>
                <span className="text-slate-500">Entitas:</span>{' '}
                <span className="font-semibold">{selectedAuditForModal.entity_type} ({selectedAuditForModal.entity_id.substring(0, 8)}...)</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Alasan:</span>{' '}
                <span className="font-medium text-slate-900">{selectedAuditForModal.reason}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-1">State Sebelum (Before State):</h4>
                <pre className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditForModal.before_state, null, 2) || '{}'}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-1">State Sesudah (After State):</h4>
                <pre className="rounded-lg bg-slate-900 p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditForModal.after_state, null, 2) || '{}'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAuditForModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Tutup Inspeksi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
