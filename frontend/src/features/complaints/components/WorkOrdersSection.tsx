'use client';

import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  ExternalLink, 
  FileText, 
  Plus, 
  User, 
  Wrench 
} from 'lucide-react';
import type { Vendor, WorkOrder } from '../types';
import { formatCurrency, formatDateTime, getWorkOrderStatusBadge } from '../format';

interface WorkOrdersSectionProps {
  workOrders: WorkOrder[];
  vendors: Vendor[];
  onCreateWorkOrder: (data: {
    vendor_id?: string;
    title: string;
    description?: string;
    scheduled_date?: string;
    estimated_cost: number;
    actual_cost: number;
    invoice_url?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateStatus: (woId: string, status: string, actualCost?: number) => Promise<void>;
  isLoading?: boolean;
}

export function WorkOrdersSection({
  workOrders,
  vendors,
  onCreateWorkOrder,
  onUpdateStatus,
  isLoading,
}: WorkOrdersSectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('0');
  const [actualCost, setActualCost] = useState('0');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onCreateWorkOrder({
        vendor_id: vendorId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
        estimated_cost: parseFloat(estimatedCost) || 0,
        actual_cost: parseFloat(actualCost) || 0,
        notes: notes.trim() || undefined,
      });
      setTitle('');
      setDescription('');
      setVendorId('');
      setScheduledDate('');
      setEstimatedCost('0');
      setActualCost('0');
      setNotes('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Work Order Vendor & Teknisi
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manajemen penugasan mitra vendor, jadwal kunjungan, dan pencatatan biaya
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          {isAdding ? 'Tutup Form' : 'Buat Work Order'}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3.5">
          <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
            Formulir Work Order Baru
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Judul Pekerjaan *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Misal: Perbaikan AC bocor / Ganti pipa"
                className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Pilih Vendor / Teknisi
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              >
                <option value="">-- Pilih Vendor (Opsional) --</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.service_type}) {v.phone ? `• ${v.phone}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Estimasi Jadwal Kunjungan
              </label>
              <input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Estimasi Biaya (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
              Catatan Instruksi untuk Teknisi
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Instruksi khusus, alat yang dibawa, atau akses ke kamar..."
              className="w-full text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan Work Order'}
            </button>
          </div>
        </form>
      )}

      {/* Work Orders List */}
      <div className="space-y-3">
        {workOrders.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            Belum ada work order yang dibuat untuk tiket komplain ini.
          </div>
        ) : (
          workOrders.map((wo) => {
            const badge = getWorkOrderStatusBadge(wo.status);

            return (
              <div
                key={wo.id}
                className="p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {wo.title}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {wo.vendor_name && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        Vendor: <strong className="text-zinc-700 dark:text-zinc-300">{wo.vendor_name}</strong>
                      </span>
                    )}
                    {wo.scheduled_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        Jadwal: {formatDateTime(wo.scheduled_date)}
                      </span>
                    )}
                    <span>
                      Estimasi: {formatCurrency(wo.estimated_cost)}
                      {wo.actual_cost > 0 && ` • Aktual: ${formatCurrency(wo.actual_cost)}`}
                    </span>
                  </div>
                  {wo.notes && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 italic">
                      "{wo.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {wo.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(wo.id, 'completed', wo.estimated_cost)}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3 inline mr-1" />
                      Tandai Selesai
                    </button>
                  )}
                  {wo.invoice_url && (
                    <a
                      href={wo.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Invoice
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
