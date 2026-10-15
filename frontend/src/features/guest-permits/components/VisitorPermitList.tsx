'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  History,
  LogIn,
  LogOut,
  Moon,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sun,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import type { VisitorPermit, VisitorPermitEvent } from '../types';
import {
  checkInVisitor,
  checkOutVisitor,
  getVisitorPermit,
  tenantCancelVisitorPermit,
  tenantGetVisitorPermit,
} from '../api';
import { formatDateRange, formatDateTime, formatVehicle, getVisitorStatusBadge } from '../format';
import { VisitorPassModal } from './VisitorPassModal';
import { VisitorPermitApprovalModal } from './VisitorPermitApprovalModal';
import { VisitorPermitRequestModal } from './VisitorPermitRequestModal';
import { VisitorRetentionModal } from './VisitorRetentionModal';

interface VisitorPermitListProps {
  permits: VisitorPermit[];
  total: number;
  isLoading: boolean;
  isTenant: boolean;
  canApprove: boolean;
  canCheckInOut: boolean;
  onRefresh: () => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  fromDate: string;
  onFromDateChange: (date: string) => void;
  toDate: string;
  onToDateChange: (date: string) => void;
  isOvernightOnly: boolean;
  onOvernightChange: (val: boolean) => void;
}

export function VisitorPermitList({
  permits,
  total,
  isLoading,
  isTenant,
  canApprove,
  canCheckInOut,
  onRefresh,
  statusFilter,
  onStatusChange,
  search,
  onSearchChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  isOvernightOnly,
  onOvernightChange,
}: VisitorPermitListProps) {
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false);

  const [selectedPermit, setSelectedPermit] = useState<VisitorPermit | null>(null);
  const [detailEvents, setDetailEvents] = useState<VisitorPermitEvent[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleOpenDetail = async (permit: VisitorPermit) => {
    setSelectedPermit(permit);
    setIsDetailOpen(true);
    try {
      if (isTenant) {
        const res = await tenantGetVisitorPermit(permit.id);
        setDetailEvents(res.events || []);
      } else {
        const res = await getVisitorPermit(permit.id);
        setDetailEvents(res.events || []);
      }
    } catch {
      setDetailEvents([]);
    }
  };

  const handleCheckIn = async (permit: VisitorPermit) => {
    if (!confirm(`Konfirmasi check-in untuk tamu "${permit.guest_name}"?`)) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await checkInVisitor(permit.id);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Gagal check-in tamu.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCheckOut = async (permit: VisitorPermit) => {
    if (!confirm(`Konfirmasi check-out untuk tamu "${permit.guest_name}"?`)) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await checkOutVisitor(permit.id);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Gagal check-out tamu.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancelTenant = async (permit: VisitorPermit) => {
    const reason = prompt('Masukkan alasan pembatalan izin tamu:');
    if (reason === null) return;
    setIsActionLoading(true);
    setActionError(null);
    try {
      await tenantCancelVisitorPermit(permit.id, reason);
      onRefresh();
    } catch (err: any) {
      setActionError(err?.message || 'Gagal membatalkan izin tamu.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const tabs = [
    { id: 'all', label: 'Semua Status' },
    { id: 'pending', label: 'Menunggu' },
    { id: 'active', label: 'Aktif di Lokasi' },
    { id: 'approved', label: 'Disetujui' },
    { id: 'change_requested', label: 'Perlu Revisi' },
    { id: 'completed', label: 'Selesai' },
    { id: 'rejected', label: 'Ditolak' },
    { id: 'cancelled', label: 'Dibatalkan' },
  ];

  return (
    <div className="space-y-4">
      {/* Action Header & Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isTenant ? (
            <button
              type="button"
              onClick={() => setIsRequestModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700"
            >
              <Plus className="h-4 w-4" />
              Ajukan Izin Tamu
            </button>
          ) : (
            canApprove && (
              <button
                type="button"
                onClick={() => setIsRetentionModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/40 dark:bg-indigo-950/40 dark:text-indigo-400"
              >
                <ShieldAlert className="h-4 w-4" />
                Pembersihan Retensi (AC 4)
              </button>
            )
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari tamu / plat / kamar..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)} className="p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Date Ranges */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        {/* Tabs */}
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusChange(tab.id)}
              className={`whitespace-nowrap rounded-xl px-3.5 py-1.5 font-bold transition-all ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Date Filter & Overnight checkbox */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Tanggal:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <span className="text-slate-400">s/d</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={isOvernightOnly}
              onChange={(e) => onOvernightChange(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <Moon className="h-3.5 w-3.5 text-indigo-500" />
            <span>Hanya Yang Menginap</span>
          </label>
        </div>
      </div>

      {/* Table / List View */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600 mb-2" />
            <p>Memuat daftar izin tamu...</p>
          </div>
        ) : permits.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700 mb-2" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Tidak Ada Izin Tamu
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {isTenant
                ? 'Belum ada pengajuan izin tamu. Klik "Ajukan Izin Tamu" untuk membuat baru.'
                : 'Tidak ada data izin tamu yang sesuai dengan filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3">Tamu</th>
                  {!isTenant && <th className="px-4 py-3">Kamar / Penyewa</th>}
                  <th className="px-4 py-3">Jadwal & Menginap</th>
                  <th className="px-4 py-3">Kendaraan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {permits.map((item) => {
                  const badge = getVisitorStatusBadge(item.status, item.is_overstay);
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.guest_name}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {item.relationship} &bull; {item.total_guests} orang
                          </span>
                          {item.guest_id_card_last4 && (
                            <span className="text-[10px] text-cyan-600 dark:text-cyan-400">
                              ID akhir: ••••{item.guest_id_card_last4}
                            </span>
                          )}
                        </div>
                      </td>

                      {!isTenant && (
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">
                              Kamar {item.room_number || '-'}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {item.tenant_name || '-'}
                            </span>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {formatDateRange(item.start_time, item.end_time, item.is_overnight)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Tujuan: {item.purpose}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          {formatVehicle(item.vehicle_type, item.vehicle_number)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {item.review_notes && (
                          <p className="mt-1 text-[10px] text-slate-400 italic">
                            &ldquo;{item.review_notes}&rdquo;
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Review button for staff/owner */}
                          {!isTenant && canApprove && (item.status === 'pending' || item.status === 'change_requested') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPermit(item);
                                setIsApprovalModalOpen(true);
                              }}
                              className="rounded-xl bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-400"
                            >
                              Tinjau
                            </button>
                          )}

                          {/* Check-In button */}
                          {!isTenant && canCheckInOut && item.status === 'approved' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleCheckIn(item)}
                              className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400"
                            >
                              <LogIn className="h-3 w-3" />
                              Check-In
                            </button>
                          )}

                          {/* Check-Out button */}
                          {!isTenant && canCheckInOut && item.status === 'active' && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleCheckOut(item)}
                              className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
                            >
                              <LogOut className="h-3 w-3" />
                              Check-Out
                            </button>
                          )}

                          {/* Visitor Pass button (if approved or active) */}
                          {(item.status === 'approved' || item.status === 'active' || item.pass_token) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPermit(item);
                                setIsPassModalOpen(true);
                              }}
                              title="Lihat Pass Digital"
                              className="rounded-xl border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              <FileCheck className="h-4 w-4" />
                            </button>
                          )}

                          {/* Cancel for tenant if pending */}
                          {isTenant && (item.status === 'pending' || item.status === 'change_requested') && (
                            <button
                              type="button"
                              disabled={isActionLoading}
                              onClick={() => handleCancelTenant(item)}
                              className="rounded-xl border border-red-200 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
                            >
                              Batalkan
                            </button>
                          )}

                          {/* Audit history drawer button */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            title="Riwayat & Audit Trail"
                            className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800"
                          >
                            <History className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit History Timeline Drawer / Modal */}
      {isDetailOpen && selectedPermit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Audit Trail & Riwayat Keputusan (AC 3)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-3.5 text-xs dark:bg-slate-800/40">
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedPermit.guest_name} ({selectedPermit.relationship})
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kamar {selectedPermit.room_number || '-'} &bull; Diajukan {formatDateTime(selectedPermit.created_at)}
                </p>
              </div>

              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {detailEvents.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-400">Belum ada riwayat aktivitas event.</p>
                ) : (
                  detailEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-2xl border border-slate-100 bg-white p-3 text-xs shadow-xs dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
                          {ev.event_type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(ev.created_at)}</span>
                      </div>
                      <p className="mt-1 text-slate-700 dark:text-slate-300">
                        Aktor: {ev.actor_name || 'Sistem'} ({ev.actor_role})
                      </p>
                      {ev.reason && (
                        <p className="mt-1 rounded-xl bg-slate-50 p-2 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Catatan: {ev.reason}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <VisitorPermitRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={() => onRefresh()}
      />

      <VisitorPermitApprovalModal
        isOpen={isApprovalModalOpen}
        permit={selectedPermit}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedPermit(null);
        }}
        onSuccess={() => onRefresh()}
      />

      <VisitorPassModal
        isOpen={isPassModalOpen}
        permit={selectedPermit}
        onClose={() => {
          setIsPassModalOpen(false);
          setSelectedPermit(null);
        }}
      />

      <VisitorRetentionModal
        isOpen={isRetentionModalOpen}
        onClose={() => setIsRetentionModalOpen(false)}
        onSuccess={() => onRefresh()}
      />
    </div>
  );
}
