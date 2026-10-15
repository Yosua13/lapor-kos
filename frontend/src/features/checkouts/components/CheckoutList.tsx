'use client';

import React, { useEffect, useState } from 'react';
import { listCheckouts } from '../api';
import type { CheckoutCase, CheckoutStatus } from '../types';
import { formatCurrency, formatDate, getCheckoutStatusBadge } from '../format';
import { CheckoutNoticeModal } from './CheckoutNoticeModal';
import { InspectionModal } from './InspectionModal';
import { SettlementReviewModal } from './SettlementReviewModal';
import {
  Calendar,
  CheckCircle,
  ClipboardList,
  DollarSign,
  FileText,
  Key,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';

export const CheckoutList: React.FC = () => {
  const [checkouts, setCheckouts] = useState<CheckoutCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [activeInspectionCheckout, setActiveInspectionCheckout] = useState<CheckoutCase | null>(null);
  const [activeSettlementCheckout, setActiveSettlementCheckout] = useState<CheckoutCase | null>(null);

  const fetchCheckouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listCheckouts({
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setCheckouts(res.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data checkout');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckouts();
  }, [statusFilter]);

  const filteredCheckouts = checkouts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.tenant_name || '').toLowerCase().includes(q) ||
      (c.room_number || '').toLowerCase().includes(q) ||
      (c.reason || '').toLowerCase().includes(q)
    );
  });

  const handleActionSuccess = (updated: CheckoutCase) => {
    setCheckouts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    fetchCheckouts();
  };

  const tabs = [
    { id: 'all', label: 'Semua' },
    { id: 'submitted', label: 'Notice Baru' },
    { id: 'inspection_completed', label: 'Inspeksi Selesai' },
    { id: 'approved', label: 'Disetujui' },
    { id: 'completed', label: 'Selesai (Closed)' },
    { id: 'cancelled', label: 'Dibatalkan' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Checkout & Settlement
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Kelola penutupan hunian, inspeksi checklist kamar, serah terima kunci, dan pelunasan deposit (Epic #46).
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchCheckouts()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Segarkan
          </button>
          <button
            onClick={() => setIsNoticeModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
          >
            <Plus className="h-4 w-4" /> Ajukan Notice Checkout
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari penghuni, kamar, alasan..."
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          <Search className="absolute left-3 top-2 h-4 w-4 text-slate-400" />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 p-4 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Content Table / Cards */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Memuat data alur checkout...
        </div>
      ) : filteredCheckouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">Tidak ada pengajuan checkout</h3>
          <p className="mt-1 text-xs text-slate-500">
            {statusFilter !== 'all' ? 'Tidak ada data pada filter status ini.' : 'Belum ada penghuni yang mengajukan checkout.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Kamar & Penghuni</th>
                  <th className="px-4 py-3">Jadwal Checkout</th>
                  <th className="px-4 py-3">Status Workflow</th>
                  <th className="px-4 py-3">Kunci & Inspeksi</th>
                  <th className="px-4 py-3">Hasil Settlement</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCheckouts.map((item) => {
                  const badge = getCheckoutStatusBadge(item.status);
                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          Kamar {item.room_number || '-'}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">{item.tenant_name || '-'}</div>
                        <div className="text-[10px] text-slate-400">{item.reason}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          <span>{formatDate(item.scheduled_checkout_date)}</span>
                        </div>
                        {item.actual_checkout_date && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                            Realisasi: {formatDate(item.actual_checkout_date)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-[11px]">
                            {item.key_returned ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <Key className="h-3.5 w-3.5" /> Kunci Kembali
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Key className="h-3.5 w-3.5" /> Kunci Belum
                              </span>
                            )}
                          </div>
                          {item.inspections && item.inspections.length > 0 ? (
                            <div className="text-[10px] text-indigo-600 dark:text-indigo-400">
                              {item.inspections.length} aset diperiksa
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-400">Belum ada checklist</div>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        {item.settlement ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {item.settlement.settlement_type === 'refund' && (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  Refund: {formatCurrency(item.settlement.net_settlement_minor)}
                                </span>
                              )}
                              {item.settlement.settlement_type === 'invoice' && (
                                <span className="text-rose-600 dark:text-rose-400">
                                  Kurang: {formatCurrency(Math.abs(item.settlement.net_settlement_minor))}
                                </span>
                              )}
                              {item.settlement.settlement_type === 'zero_balance' && (
                                <span className="text-slate-600 dark:text-slate-400">Lunas (Pas)</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">Deposit: {formatCurrency(item.settlement.deposit_held_minor)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status !== 'completed' && item.status !== 'cancelled' && (
                            <button
                              onClick={() => setActiveInspectionCheckout(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Inspeksi Kamar"
                            >
                              <ClipboardList className="h-3.5 w-3.5 text-indigo-500" /> Inspeksi
                            </button>
                          )}

                          <button
                            onClick={() => setActiveSettlementCheckout(item)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                            title="Review Settlement & Eksekusi"
                          >
                            <DollarSign className="h-3.5 w-3.5" />
                            {item.status === 'completed' ? 'Lihat Statement' : 'Settlement'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <CheckoutNoticeModal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        onSuccess={() => fetchCheckouts()}
      />

      {activeInspectionCheckout && (
        <InspectionModal
          isOpen={Boolean(activeInspectionCheckout)}
          onClose={() => setActiveInspectionCheckout(null)}
          onSuccess={handleActionSuccess}
          checkout={activeInspectionCheckout}
        />
      )}

      {activeSettlementCheckout && (
        <SettlementReviewModal
          isOpen={Boolean(activeSettlementCheckout)}
          onClose={() => setActiveSettlementCheckout(null)}
          onSuccess={handleActionSuccess}
          checkout={activeSettlementCheckout}
        />
      )}
    </div>
  );
};
