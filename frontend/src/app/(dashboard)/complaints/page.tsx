'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, getImageUrl } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import type { Complaint, SLADashboardStats } from '@/features/complaints/types';
import { 
  formatDateTime, 
  getCategoryLabel, 
  getImpactBadge, 
  getPriorityBadge, 
  getSLABadge, 
  getStatusBadge 
} from '@/features/complaints/format';
import { getOwnerComplaints, getSLADashboard, getTenantComplaints } from '@/features/complaints/api';
import { SLADashboardCard } from '@/features/complaints/components/SLADashboardCard';
import { 
  AlertCircle, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  DoorOpen, 
  Flame, 
  HelpCircle, 
  Image as ImageIcon, 
  Info, 
  MessageSquare, 
  Plus, 
  RefreshCw, 
  Send, 
  Settings, 
  ShieldAlert, 
  Trash2, 
  Upload, 
  User, 
  VolumeX, 
  Wrench, 
  X 
} from 'lucide-react';

export default function ComplaintsPage() {
  const router = useRouter();
  const { can, isTenant } = useAuthorization();
  const canManageComplaints = can(CAPABILITIES.COMPLAINT_MANAGE);
  const [user, setUser] = useState<any>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [slaStats, setSlaStats] = useState<SLADashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form states (Tenant)
  const [category, setCategory] = useState('facility');
  const [priority, setPriority] = useState('medium');
  const [impact, setImpact] = useState('minor');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessWindow, setAccessWindow] = useState('');
  const [preferredContact, setPreferredContact] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<Complaint | null>(null);

  // Owner Config & Filters
  const [waGroupLink, setWaGroupLink] = useState('');
  const [isSavingWA, setIsSavingWA] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserAndComplaints();
  }, [isTenant]);

  const fetchUserAndComplaints = async () => {
    setIsLoading(true);
    try {
      const userData = await apiFetch('/api/auth/me');
      setUser(userData);

      if (!isTenant) {
        setWaGroupLink(userData.whatsapp_group_link || '');
        const [complaintsData, statsData] = await Promise.allSettled([
          getOwnerComplaints(),
          getSLADashboard(),
        ]);
        if (complaintsData.status === 'fulfilled') setComplaints(complaintsData.value);
        if (statsData.status === 'fulfilled') setSlaStats(statsData.value);
      } else {
        const data = await getTenantComplaints();
        setComplaints(data);
      }
    } catch (err) {
      console.error('Failed to load complaints data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const previewUrl = URL.createObjectURL(file);
      setPhotoPreview(previewUrl);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      setPhotoPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveWhatsAppGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWA(true);
    try {
      await apiFetch('/api/complaints/whatsapp-group', {
        method: 'PUT',
        body: JSON.stringify({ whatsapp_group_link: waGroupLink }),
        propertyScoped: true,
      });
      alert('Tautan grup WhatsApp berhasil disimpan!');
    } catch (err: any) {
      alert('Gagal menyimpan grup WhatsApp: ' + err.message);
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Judul dan deskripsi keluhan wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      let uploadedPhotoUrl = '';
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const uploadRes = await apiFetch<{ photo_url: string }>('/api/complaints/upload', {
          method: 'POST',
          body: formData,
        });
        uploadedPhotoUrl = uploadRes.photo_url;
      }

      const newComplaint = await apiFetch<Complaint>('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          category,
          priority,
          impact,
          title,
          description,
          access_window: accessWindow.trim() || undefined,
          preferred_contact: preferredContact.trim() || undefined,
          photo_url: uploadedPhotoUrl || undefined,
        }),
      });

      setJustSubmitted(newComplaint);
      setTitle('');
      setDescription('');
      setAccessWindow('');
      setPreferredContact('');
      removePhoto();
      fetchUserAndComplaints();
    } catch (err: any) {
      alert('Gagal mengirim keluhan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter complaints
  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) {
      if (statusFilter === 'in_progress' && c.status === 'processed') return true;
      return false;
    }
    if (priorityFilter !== 'all' && c.priority !== priorityFilter) {
      return false;
    }
    if (slaFilter !== 'all' && c.sla_status !== slaFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Komplain & Maintenance
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {isTenant
              ? 'Laporkan kendala fasilitas kamar atau gangguan kenyamanan dengan jaminan SLA terukur.'
              : 'Pusat pengelolaan maintenance, work order teknisi, dan pemantauan SLA properti.'}
          </p>
        </div>
      </div>

      {/* SLA Dashboard for Staff / Owner (AC 4) */}
      {!isTenant && (
        <SLADashboardCard stats={slaStats} isLoading={isLoading} />
      )}

      {/* Tenant View: Filing Form + History */}
      {isTenant ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Submission Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Buat Laporan Keluhan
              </h2>
              <p className="text-xs text-zinc-500 mb-5">
                Pengelola kos akan segera menindaklanjuti sesuai prioritas dan target SLA.
              </p>

              {justSubmitted && (
                <div className="mb-5 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Laporan Berhasil Terkirim!
                  </div>
                  {justSubmitted.ai_response && (
                    <div className="p-3 bg-white/70 dark:bg-zinc-900/60 rounded-lg text-zinc-700 dark:text-zinc-300 italic border border-emerald-100 dark:border-emerald-900">
                      "{justSubmitted.ai_response}"
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/complaints/${justSubmitted.id}`)}
                    className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline block"
                  >
                    Lihat Progres Tiket #{justSubmitted.id.slice(0, 8)} &rarr;
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmitComplaint} className="space-y-4 text-xs">
                {/* Category Selection */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Kategori Masalah *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'facility', label: 'Fasilitas Rusak', icon: Wrench },
                      { id: 'cleanliness', label: 'Kebersihan', icon: Trash2 },
                      { id: 'noisy', label: 'Keributan / Suara', icon: VolumeX },
                      { id: 'security', label: 'Keamanan', icon: ShieldAlert },
                    ].map((c) => {
                      const Icon = c.icon;
                      const selected = category === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategory(c.id)}
                          className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-all ${
                            selected
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{c.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Priority Selection for Tenant */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Tingkat Urgensi
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPriority('medium');
                        setImpact('minor');
                      }}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        priority === 'medium'
                          ? 'border-blue-500 bg-blue-50/40 text-blue-800 dark:text-blue-200 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600'
                      }`}
                    >
                      <div className="font-semibold">Normal / Standar</div>
                      <div className="text-[10px] text-zinc-500">Penanganan rutin</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPriority('urgent');
                        setImpact('emergency');
                      }}
                      className={`p-2 rounded-lg border text-left text-xs ${
                        priority === 'urgent'
                          ? 'border-red-500 bg-red-50/40 text-red-800 dark:text-red-200 font-semibold'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600'
                      }`}
                    >
                      <div className="font-semibold text-red-600 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" /> Darurat (Urgent)
                      </div>
                      <div className="text-[10px] text-zinc-500">Bocor parah/korslet</div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Judul Keluhan *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: AC kamar tidak dingin / Kran air wastafel bocor"
                    className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Deskripsi Lengkap *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan detail kendala, sejak kapan terjadi, dan lokasi spesifik..."
                    className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Access Window */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Preferensi Jam Kunjungan Teknisi
                  </label>
                  <input
                    type="text"
                    value={accessWindow}
                    onChange={(e) => setAccessWindow(e.target.value)}
                    placeholder="Contoh: Pagi jam 09:00 - 11:00 atau setelah jam 17:00"
                    className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Foto Bukti Masalah (Opsional)
                  </label>
                  {photoPreview ? (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 max-h-48">
                      <img src={photoPreview} alt="Preview" className="w-full h-auto object-cover" />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-2 right-2 p-1 bg-black/60 text-white rounded-full hover:bg-black/80"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-4 cursor-pointer hover:border-blue-500 transition-colors">
                      <Upload className="w-5 h-5 text-zinc-400 mb-1" />
                      <span className="text-[11px] text-zinc-500">Klik untuk unggah foto</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-xs flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Mengirim Laporan...' : 'Kirim Komplain'}
                </button>
              </form>
            </div>
          </div>

          {/* Tenant Complaints History */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Daftar Komplain Saya ({complaints.length})
            </h2>

            {complaints.length === 0 ? (
              <div className="text-center py-12 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-sm">
                Belum ada komplain yang pernah Anda laporkan.
              </div>
            ) : (
              <div className="space-y-3">
                {complaints.map((item) => {
                  const priorityB = getPriorityBadge(item.priority);
                  const statusB = getStatusBadge(item.status);
                  const slaB = getSLABadge(item.sla_status);

                  return (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/complaints/${item.id}`)}
                      className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-400 rounded-2xl shadow-xs cursor-pointer transition-all space-y-3 group"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${priorityB.color}`}>
                            {priorityB.label}
                          </span>
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusB.color}`}>
                            {statusB.label}
                          </span>
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${slaB.color}`}>
                            {slaB.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          {formatDateTime(item.created_at)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </h3>

                      <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
                        <span>Kategori: {getCategoryLabel(item.category)}</span>
                        <span className="text-blue-600 font-semibold group-hover:underline">
                          Lihat Detail &rarr;
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Staff / Owner View */
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'Semua Status' },
                { id: 'pending', label: 'Menunggu' },
                { id: 'in_progress', label: 'Diproses' },
                { id: 'scheduled', label: 'Terjadwal' },
                { id: 'resolved', label: 'Selesai' },
                { id: 'confirmed', label: 'Dikonfirmasi' },
                { id: 'reopened', label: 'Dibuka Kembali' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === s.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* SLA & Priority Dropdown Filters */}
            <div className="flex items-center gap-2">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">Semua Prioritas</option>
                <option value="urgent">Urgent / Darurat</option>
                <option value="high">Tinggi</option>
                <option value="medium">Sedang</option>
                <option value="low">Rendah</option>
              </select>

              <select
                value={slaFilter}
                onChange={(e) => setSlaFilter(e.target.value)}
                className="text-xs p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200"
              >
                <option value="all">Semua SLA</option>
                <option value="within_sla">Sesuai SLA</option>
                <option value="warning">Mendekati Batas</option>
                <option value="breached">Breached (Lewat Batas)</option>
              </select>
            </div>
          </div>

          {/* Complaints Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredComplaints.length === 0 ? (
              <div className="col-span-full text-center py-12 p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 text-sm">
                Tidak ada komplain yang cocok dengan filter yang dipilih.
              </div>
            ) : (
              filteredComplaints.map((item) => {
                const priorityB = getPriorityBadge(item.priority);
                const impactB = getImpactBadge(item.impact);
                const statusB = getStatusBadge(item.status);
                const slaB = getSLABadge(item.sla_status);

                return (
                  <div
                    key={item.id}
                    onClick={() => router.push(`/complaints/${item.id}`)}
                    className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 rounded-2xl shadow-xs cursor-pointer transition-all flex flex-col justify-between group space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${priorityB.color}`}>
                          {priorityB.label}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusB.color}`}>
                          {statusB.label}
                        </span>
                      </div>

                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base group-hover:text-blue-600 transition-colors line-clamp-2">
                        {item.title}
                      </h3>

                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${impactB.color}`}>
                          {impactB.label}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${slaB.color}`}>
                          {slaB.label}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 text-xs text-zinc-500">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                          <DoorOpen className="w-3.5 h-3.5 text-zinc-400" />
                          Kamar {item.room_number || '-'}
                        </span>
                        <span>{item.user_name || 'Penyewa'}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Target: {formatDateTime(item.resolution_due_at)}</span>
                        {item.work_orders_count ? (
                          <span className="text-purple-600 font-semibold">
                            {item.work_orders_count} Work Order
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
