'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  DoorOpen, 
  User, 
  MessageSquare, 
  VolumeX, 
  Wrench, 
  Trash2, 
  ShieldAlert, 
  HelpCircle, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw,
  ExternalLink,
  Phone,
  ShieldCheck,
  Flame,
  UserCheck
} from 'lucide-react';
import { getImageUrl } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import type { 
  AISuggestion, 
  Complaint, 
  ComplaintEvent, 
  Vendor, 
  WorkOrder 
} from '@/features/complaints/types';
import { 
  formatDateTime, 
  getCategoryLabel, 
  getImpactBadge, 
  getPriorityBadge, 
  getSLABadge, 
  getStatusBadge 
} from '@/features/complaints/format';
import { 
  addTimelineEvent,
  applyAISuggestion,
  assignComplaint,
  confirmComplaintResolution,
  createWorkOrder,
  getAISuggestion,
  getComplaint,
  getComplaintTimeline,
  getTenantComplaint,
  getVendors,
  getWorkOrders,
  reopenComplaint,
  triageComplaint,
  updateComplaintStatus,
  updateWorkOrder
} from '@/features/complaints/api';
import { SafeTimelineView } from '@/features/complaints/components/SafeTimelineView';
import { TriageModal } from '@/features/complaints/components/TriageModal';
import { WorkOrdersSection } from '@/features/complaints/components/WorkOrdersSection';
import { AISuggestionBanner } from '@/features/complaints/components/AISuggestionBanner';
import { TenantResolutionActions } from '@/features/complaints/components/TenantResolutionActions';

export default function ComplaintDetailPage() {
  const router = useRouter();
  const { can, isTenant } = useAuthorization();
  const canManage = can(CAPABILITIES.COMPLAINT_MANAGE);
  const params = useParams();
  const id = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ComplaintEvent[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
  };

  const loadAllData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      if (isTenant) {
        const comp = await getTenantComplaint(id);
        setComplaint(comp);
        const events = await getComplaintTimeline(id, true);
        setTimelineEvents(events);
      } else {
        const [comp, events, suggestion, orders, vendorList] = await Promise.allSettled([
          getComplaint(id),
          getComplaintTimeline(id, false),
          getAISuggestion(id),
          getWorkOrders(id),
          getVendors(false),
        ]);

        if (comp.status === 'fulfilled') setComplaint(comp.value);
        if (events.status === 'fulfilled') setTimelineEvents(events.value);
        if (suggestion.status === 'fulfilled') setAiSuggestion(suggestion.value);
        if (orders.status === 'fulfilled') setWorkOrders(orders.value);
        if (vendorList.status === 'fulfilled') setVendors(vendorList.value);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat detail komplain', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    loadAllData();
  }, [id, isTenant]);

  // Handlers
  const handleTriage = async (data: any) => {
    try {
      await triageComplaint(id, data);
      showToast('Triage tiket komplain berhasil disimpan');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menyimpan triage', 'error');
    }
  };

  const handleUpdateStatus = async (nextStatus: string, notes?: string) => {
    try {
      await updateComplaintStatus(id, nextStatus, notes);
      showToast(`Status berhasil diperbarui ke: ${nextStatus}`);
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui status', 'error');
    }
  };

  const handleAddComment = async (message: string, visibility: 'public' | 'internal') => {
    try {
      await addTimelineEvent(id, isTenant, {
        event_type: 'comment_added',
        visibility,
        message,
      });
      showToast('Komentar berhasil ditambahkan');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengirim komentar', 'error');
    }
  };

  const handleApplyAI = async (data: any) => {
    try {
      await applyAISuggestion(id, data);
      showToast('Rekomendasi AI berhasil diterapkan ke tiket');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal menerapkan saran AI', 'error');
    }
  };

  const handleCreateWorkOrder = async (data: any) => {
    try {
      await createWorkOrder(id, data);
      showToast('Work order teknisi berhasil dibuat');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat work order', 'error');
    }
  };

  const handleUpdateWorkOrderStatus = async (woId: string, status: string, actualCost?: number) => {
    try {
      const existing = workOrders.find((w) => w.id === woId);
      if (!existing) return;
      await updateWorkOrder(id, woId, {
        vendor_id: existing.vendor_id,
        title: existing.title,
        description: existing.description,
        status,
        scheduled_date: existing.scheduled_date,
        estimated_cost: existing.estimated_cost,
        actual_cost: actualCost !== undefined ? actualCost : existing.actual_cost,
        invoice_url: existing.invoice_url,
        notes: existing.notes,
      });
      showToast('Status work order berhasil diperbarui');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal memperbarui work order', 'error');
    }
  };

  const handleConfirmResolution = async (comment?: string) => {
    try {
      await confirmComplaintResolution(id, comment);
      showToast('Penyelesaian komplain berhasil dikonfirmasi');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal mengonfirmasi penyelesaian', 'error');
    }
  };

  const handleReopen = async (reason: string) => {
    try {
      await reopenComplaint(id, reason);
      showToast('Tiket komplain berhasil dibuka kembali');
      loadAllData();
    } catch (err: any) {
      showToast(err.message || 'Gagal membuka kembali tiket', 'error');
    }
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-zinc-500">Memuat rincian tiket komplain...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-3 bg-red-50 text-red-600 rounded-full w-fit mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
          Tiket Komplain Tidak Ditemukan
        </h3>
        <p className="text-sm text-zinc-500">
          Tiket yang Anda cari mungkin telah dihapus atau Anda tidak memiliki akses ke properti ini.
        </p>
        <button
          onClick={() => router.push('/complaints')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar
        </button>
      </div>
    );
  }

  const priorityBadge = getPriorityBadge(complaint.priority);
  const impactBadge = getImpactBadge(complaint.impact);
  const statusBadge = getStatusBadge(complaint.status);
  const slaBadge = getSLABadge(complaint.sla_status);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-in fade-in slide-in-from-bottom-5 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => router.push('/complaints')}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Komplain
        </button>

        {!isTenant && canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTriageOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors shadow-xs"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Triage & Atur SLA
            </button>

            {complaint.status !== 'resolved' && complaint.status !== 'confirmed' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('resolved')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Tandai Selesai
              </button>
            )}

            {complaint.status === 'pending' && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('in_progress')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Mulai Proses
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tenant Resolution Action Banner (AC 3) */}
      {isTenant && (
        <TenantResolutionActions
          complaintId={complaint.id}
          status={complaint.status}
          onConfirm={handleConfirmResolution}
          onReopen={handleReopen}
        />
      )}

      {/* AI Advisory Banner for Staff (AC 5) */}
      {!isTenant && (
        <AISuggestionBanner
          suggestion={aiSuggestion}
          onApply={handleApplyAI}
        />
      )}

      {/* Main Ticket Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6">
        {/* Title and Badges */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${priorityBadge.color}`}>
              {priorityBadge.label}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${impactBadge.color}`}>
              {impactBadge.label}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${slaBadge.color}`}>
              {slaBadge.label}
            </span>
          </div>

          <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {complaint.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-zinc-400" />
              Dilaporkan: {formatDateTime(complaint.created_at)}
            </span>
            {complaint.room_number && (
              <span className="flex items-center gap-1.5">
                <DoorOpen className="w-4 h-4 text-zinc-400" />
                Kamar: <strong className="text-zinc-800 dark:text-zinc-200">{complaint.room_number}</strong>
              </span>
            )}
            {complaint.user_name && (
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-zinc-400" />
                Pelapor: <strong className="text-zinc-800 dark:text-zinc-200">{complaint.user_name}</strong>
              </span>
            )}
            {complaint.assignee_name && (
              <span className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-blue-500" />
                PIC: <strong className="text-zinc-800 dark:text-zinc-200">{complaint.assignee_name}</strong>
              </span>
            )}
          </div>
        </div>

        {/* SLA Milestones Tracker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs">
          <div>
            <div className="text-zinc-500 mb-0.5">Target Respon Pertama:</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatDateTime(complaint.first_response_due_at)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {complaint.first_response_at
                ? `Ditanggapi: ${formatDateTime(complaint.first_response_at)}`
                : 'Belum ditanggapi'}
            </div>
          </div>

          <div>
            <div className="text-zinc-500 mb-0.5">Target Penyelesaian:</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {formatDateTime(complaint.resolution_due_at)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              {complaint.resolved_at
                ? `Diselesaikan: ${formatDateTime(complaint.resolved_at)}`
                : 'Belum selesai'}
            </div>
          </div>

          <div>
            <div className="text-zinc-500 mb-0.5">Akses Kunjungan (Window):</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {complaint.access_window || 'Tidak ada preferensi jam'}
            </div>
          </div>

          <div>
            <div className="text-zinc-500 mb-0.5">Kontak Disukai:</div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              {complaint.preferred_contact || 'WhatsApp / Aplikasi'}
            </div>
          </div>
        </div>

        {/* Description & Photo */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
              Deskripsi Keluhan
            </h3>
            <p className="text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {complaint.description}
            </p>
          </div>

          {complaint.photo_url && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                Foto Bukti Masalah
              </h3>
              <div className="relative inline-block overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 group">
                <img
                  src={getImageUrl(complaint.photo_url)}
                  alt="Bukti komplain"
                  className="max-h-72 w-auto object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                />
                <a
                  href={getImageUrl(complaint.photo_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-opacity"
                >
                  <ExternalLink className="w-4 h-4" />
                  Buka Gambar Penuh
                </a>
              </div>
            </div>
          )}

          {/* AI Empathic Response Display */}
          {complaint.ai_response && (
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-300">
                <MessageSquare className="w-3.5 h-3.5" />
                Tanggapan Sistem Lapor Kos
              </div>
              <p className="text-blue-800 dark:text-blue-200 leading-relaxed italic">
                "{complaint.ai_response}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Work Orders Section for Staff */}
      {!isTenant && (
        <WorkOrdersSection
          workOrders={workOrders}
          vendors={vendors}
          onCreateWorkOrder={handleCreateWorkOrder}
          onUpdateStatus={handleUpdateWorkOrderStatus}
        />
      )}

      {/* Safe Append-Only Timeline View (AC 2) */}
      <SafeTimelineView
        events={timelineEvents}
        isTenant={isTenant}
        onAddComment={handleAddComment}
      />

      {/* Triage Modal (AC 1) */}
      <TriageModal
        complaint={complaint}
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
        onTriageSubmit={handleTriage}
      />
    </div>
  );
}
