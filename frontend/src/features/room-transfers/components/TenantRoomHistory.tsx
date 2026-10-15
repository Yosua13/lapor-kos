'use client';

import React, { useState, useEffect } from 'react';
import {
  DoorOpen,
  Calendar,
  Clock,
  Filter,
  RotateCcw,
  Loader2,
  CheckCircle2,
  History,
  ArrowRight,
  Info,
} from 'lucide-react';
import { getTenantRoomHistory, getMyRoomHistory } from '../api';
import { formatDateDisplay, formatMinorMoney } from '../format';
import type { TenantRoomHistoryItem } from '../types';

interface TenantRoomHistoryProps {
  tenantId?: string; // If provided, fetches for this tenant (staff mode). If omitted, fetches for current logged-in tenant.
  isTenant?: boolean;
}

export function TenantRoomHistory({ tenantId, isTenant = false }: TenantRoomHistoryProps) {
  const [history, setHistory] = useState<TenantRoomHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: TenantRoomHistoryItem[] = [];
      if (isTenant || !tenantId) {
        data = await getMyRoomHistory(startDate || undefined, endDate || undefined);
      } else {
        data = await getTenantRoomHistory(tenantId, startDate || undefined, endDate || undefined);
      }
      setHistory(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat histori kamar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, isTenant]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    // Trigger fetch after reset
    setTimeout(() => {
      if (isTenant || !tenantId) {
        getMyRoomHistory().then(setHistory).catch(() => {});
      } else {
        getTenantRoomHistory(tenantId).then(setHistory).catch(() => {});
      }
    }, 0);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
      {/* Header and Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-[#0e8a7a]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-[17px] text-brand-navy">
              Histori Kamar Penghuni
            </h3>
            <p className="text-[12px] text-gray-500">
              Riwayat hunian kamar berdasarkan rentang tanggal dan event perpindahan
            </p>
          </div>
        </div>

        {/* Date Filter Form */}
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px]">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              placeholder="Dari"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent border-none text-gray-700 focus:outline-none text-[12px]"
            />
          </div>
          <span className="text-gray-400 text-[12px]">-</span>
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 text-[12px]">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="date"
              placeholder="Sampai"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent border-none text-gray-700 focus:outline-none text-[12px]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-brand-navy hover:bg-slate-800 text-white rounded-xl text-[12px] font-bold transition-colors flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={handleResetFilter}
              className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-[12px] font-medium transition-colors"
              title="Reset Filter"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-[#0e8a7a]" />
          <p className="text-[13px]">Memuat histori kamar...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="py-10 text-center text-gray-400">
          <DoorOpen className="w-10 h-10 mx-auto text-gray-300 mb-2 stroke-[1.5]" />
          <p className="text-[14px] font-semibold text-gray-600">Belum Ada Histori Kamar</p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {startDate || endDate
              ? 'Tidak ditemukan riwayat hunian pada rentang tanggal yang dipilih.'
              : 'Penghuni ini belum memiliki catatan riwayat hunian.'}
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-teal-100 ml-4 pl-6 space-y-6">
          {history.map((item, idx) => (
            <div key={item.id} className="relative group">
              {/* Timeline marker */}
              <div
                className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white ${
                  item.is_current
                    ? 'border-[#0e8a7a] ring-4 ring-teal-50'
                    : 'border-gray-300'
                }`}
              />

              <div
                className={`p-4 rounded-xl border transition-all ${
                  item.is_current
                    ? 'bg-teal-50/40 border-teal-200/80 shadow-sm'
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-display font-extrabold text-[16px] text-brand-navy">
                      Kamar {item.room_number}
                    </span>
                    {item.room_type && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[11px] font-medium">
                        {item.room_type}
                      </span>
                    )}
                    {item.is_current ? (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Hunian Saat Ini
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] font-medium">
                        Selesai
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] font-bold text-gray-700">
                    {formatMinorMoney(item.price_per_month_minor)}/bln
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-gray-500 mb-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>
                      Periode:{' '}
                      <strong className="text-gray-700">
                        {formatDateDisplay(item.start_date)}
                      </strong>{' '}
                      s/d{' '}
                      <strong className="text-gray-700">
                        {formatDateDisplay(item.end_date)}
                      </strong>
                    </span>
                  </div>
                  {item.closed_at && (
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Ditutup: {formatDateDisplay(item.closed_at)}</span>
                    </div>
                  )}
                </div>

                {item.transfer_reason && (
                  <div className="mt-2.5 pt-2 border-t border-gray-100/80 flex items-start gap-2 text-[12px] text-teal-800 bg-teal-50/60 p-2.5 rounded-lg">
                    <Info className="w-3.5 h-3.5 text-[#0e8a7a] shrink-0 mt-0.5" />
                    <span>
                      <strong>Alasan Pindah:</strong> {item.transfer_reason}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
