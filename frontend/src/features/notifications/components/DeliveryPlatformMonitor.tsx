'use client';

import { useState, useEffect } from 'react';
import {
  Activity,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Eye,
  X,
  Send,
} from 'lucide-react';
import { getOutboxList, retryOutboxItem } from '../api';
import { getOutboxStatusBadge, getOutboxStatusLabel, getDeliveryStatusLabel, formatRelativeTime } from '../format';
import type { NotificationOutboxItem, OutboxStatus } from '../types';

interface DeliveryPlatformMonitorProps {
  propertyId: string;
}

export function DeliveryPlatformMonitor({ propertyId }: DeliveryPlatformMonitorProps) {
  const [items, setItems] = useState<NotificationOutboxItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<NotificationOutboxItem | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadOutbox = async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const res = await getOutboxList(propertyId, {
        status: statusFilter,
        channel: channelFilter,
        limit: 50,
      });
      setItems(res.items || []);
      setTotalCount(res.total_count || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOutbox();
  }, [propertyId, statusFilter, channelFilter]);

  const handleRetry = async (outboxId: string) => {
    setRetryingId(outboxId);
    setActionFeedback(null);
    try {
      const updated = await retryOutboxItem(propertyId, outboxId);
      setItems((prev) => prev.map((item) => (item.id === outboxId ? updated : item)));
      if (selectedItem && selectedItem.id === outboxId) {
        setSelectedItem(updated);
      }
      setActionFeedback({
        type: 'success',
        message: `Pengiriman ulang event ${updated.event_type} berhasil diproses (Status: ${getOutboxStatusLabel(updated.status)})`,
      });
      setTimeout(() => setActionFeedback(null), 4000);
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Gagal melakukan retry pengiriman',
      });
    } finally {
      setRetryingId(null);
    }
  };

  const deliveredCount = items.filter((i) => i.status === 'delivered').length;
  const failedCount = items.filter((i) => i.status === 'failed' || i.status === 'partially_delivered').length;
  const pendingCount = items.filter((i) => i.status === 'pending' || i.status === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500">Total Event Tercatat</p>
          <p className="text-2xl font-bold text-brand-navy mt-1">{totalCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Berhasil Terkirim
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{deliveredCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Gagal / Butuh Retry
          </p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{failedCount}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            Dalam Antrean
          </p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {actionFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{actionFeedback.message}</span>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-teal"
            >
              <option value="all">Semua Status</option>
              <option value="delivered">Terkirim</option>
              <option value="failed">Gagal</option>
              <option value="pending">Menunggu</option>
              <option value="skipped">Dilewati (Jam Tenang/Opt-out)</option>
              <option value="deduplicated">Duplikat (Diabaikan)</option>
            </select>
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="text-xs font-semibold rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-teal"
          >
            <option value="all">Semua Channel</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="in_app">In-App</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadOutbox}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors self-end sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segarkan Data
        </button>
      </div>

      {/* Outbox Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Penerima & Channel</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Retry</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Memuat data outbox...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">
                    Tidak ada event outbox yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const badge = getOutboxStatusBadge(item.status);
                  const isRetrying = retryingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-gray-400 whitespace-nowrap">
                        {formatRelativeTime(item.created_at)}
                      </td>
                      <td className="py-3 px-4 font-bold text-brand-navy">
                        <div>{item.event_type}</div>
                        <div className="text-[10px] font-mono text-gray-400 font-normal">
                          {item.aggregate_type} • {item.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-700 font-medium">
                          {item.recipient_phone || item.recipient_email || 'In-App User'}
                        </div>
                        <div className="text-[10px] text-gray-400 uppercase">
                          Channel: {item.channel}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}
                        >
                          {getOutboxStatusLabel(item.status)}
                        </span>
                        {item.last_error && (
                          <p className="text-[10px] text-rose-600 line-clamp-1 mt-0.5 max-w-xs" title={item.last_error}>
                            {item.last_error}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-600">
                        {item.retry_count > 0 ? `${item.retry_count}x` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedItem(item)}
                            title="Lihat Detail & Delivery Record"
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {(item.status === 'failed' || item.status === 'partially_delivered' || item.status === 'pending') && (
                            <button
                              type="button"
                              disabled={isRetrying}
                              onClick={() => handleRetry(item.id)}
                              title="Coba Kirim Ulang (Retry)"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-bold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                              Retry
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-brand-navy text-base">Detail Event Outbox</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedItem.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Event Type</span>
                <span className="font-bold text-brand-navy">{selectedItem.event_type}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Status Utama</span>
                <span className="font-bold text-brand-navy">{getOutboxStatusLabel(selectedItem.status)}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Prioritas</span>
                <span className="font-bold uppercase text-brand-navy">{selectedItem.priority}</span>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl">
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Dedup Key</span>
                <span className="font-mono text-gray-600 truncate block">{selectedItem.dedup_key || '-'}</span>
              </div>
            </div>

            {selectedItem.last_error && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <p className="font-bold text-[11px] uppercase tracking-wider mb-0.5">Alasan Kegagalan Terakhir</p>
                <p className="font-mono text-xs">{selectedItem.last_error}</p>
              </div>
            )}

            {/* Deliveries breakdown */}
            <div>
              <h4 className="font-bold text-brand-navy text-xs mb-2">Riwayat Percobaan Pengiriman (Deliveries)</h4>
              {selectedItem.deliveries && selectedItem.deliveries.length > 0 ? (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-50 text-xs overflow-hidden">
                  {selectedItem.deliveries.map((d) => (
                    <div key={d.id} className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-brand-navy uppercase text-[10px]">{d.channel}</span>
                          <span className="text-[10px] text-gray-400">• {d.recipient}</span>
                        </div>
                        {d.error_message && (
                          <p className="text-[11px] text-rose-600 mt-0.5 font-mono">{d.error_message}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {getDeliveryStatusLabel(d.status)}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatRelativeTime(d.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 p-3 bg-gray-50 rounded-xl">Belum ada delivery record terpisah</p>
              )}
            </div>

            {/* Payload Preview */}
            <div>
              <h4 className="font-bold text-brand-navy text-xs mb-1">Payload Event (Data Bisnis)</h4>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-40">
                {JSON.stringify(selectedItem.payload, null, 2)}
              </pre>
            </div>

            {/* Footer action */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-[11px] text-gray-400">Dibuat: {new Date(selectedItem.created_at).toLocaleString('id-ID')}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={retryingId === selectedItem.id}
                  onClick={() => handleRetry(selectedItem.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${retryingId === selectedItem.id ? 'animate-spin' : ''}`} />
                  Coba Kirim Ulang
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
