'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  DoorOpen, 
  User, 
  MessageSquare, 
  Send, 
  VolumeX, 
  Wrench, 
  Trash2, 
  ShieldAlert, 
  HelpCircle, 
  Image as ImageIcon, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { apiFetch, API_URL, getImageUrl } from '@/lib/api';

interface Complaint {
  id: string;
  tenant_id: string;
  owner_id: string;
  room_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  photo_url?: string;
  ai_response?: string;
  wa_sent: boolean;
  wa_message?: string;
  created_at: string;
  updated_at: string;
  room_number?: string;
  tenant_name?: string;
}

export default function ComplaintDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({ show: false, message: '', type: 'success' });

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const userData = await apiFetch('/api/auth/me');
      setUser(userData);
      
      let complaintsData: Complaint[] = [];
      if (userData.role === 'owner') {
        complaintsData = await apiFetch('/api/complaints');
      } else {
        complaintsData = await apiFetch('/api/complaints/my');
      }

      const found = complaintsData.find(c => c.id === id);
      if (found) {
        setComplaint(found);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat detail komplain', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [id]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const handleUpdateStatus = async (nextStatus: string) => {
    setIsActionLoading(true);
    try {
      await apiFetch(`/api/complaints/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      
      setComplaint((prev: any) => prev ? { ...prev, status: nextStatus } : null);
      showToast('Status komplain berhasil diperbarui!');
    } catch (err: any) {
      showToast('Gagal memperbarui status: ' + err.message, 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'noisy':
        return { label: 'Keributan', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50', icon: VolumeX };
      case 'facility':
        return { label: 'Fasilitas Rusak', color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50', icon: Wrench };
      case 'cleanliness':
        return { label: 'Kebersihan', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50', icon: Trash2 };
      case 'security':
        return { label: 'Keamanan', color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50', icon: ShieldAlert };
      default:
        return { label: 'Lainnya', color: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800', icon: HelpCircle };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Menunggu', color: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50', icon: Clock };
      case 'processed':
        return { label: 'Diproses', color: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50', icon: RefreshCw };
      default:
        return { label: 'Selesai', color: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50', icon: CheckCircle2 };
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-brand-teal mb-4" />
        <p className="text-brand-navy/40 dark:text-slate-400 font-bold text-xs uppercase tracking-widest">Memuat Detail Komplain...</p>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-brand-navy dark:text-slate-100">Komplain tidak ditemukan</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">Laporan komplain dengan ID tersebut tidak ditemukan atau Anda tidak memiliki akses.</p>
        <button 
          onClick={() => router.push('/complaints')} 
          className="mt-6 px-5 py-2.5 bg-brand-teal text-white font-bold rounded-xl text-sm hover:bg-brand-teal-light transition-colors"
        >
          Kembali
        </button>
      </div>
    );
  }

  const isOwner = user?.role === 'owner';
  const cat = getCategoryDetails(complaint.category);
  const CategoryIcon = cat.icon;
  const status = getStatusBadge(complaint.status);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 animate-slide-up px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <button onClick={() => router.push('/complaints')} className="text-gray-400 hover:text-brand-navy dark:hover:text-white transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Komplain & Pengaduan
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-brand-navy dark:text-slate-100 font-bold">Detail Laporan</span>
      </div>

      {/* Hero Card */}
      <div className="bg-white dark:bg-[#0F172A] border-[1.5px] border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal rounded-2xl flex items-center justify-center text-3xl font-bold shadow-sm shrink-0">
            <CategoryIcon className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 ${status.color}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.label}
              </span>
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border flex items-center gap-1.5 ${cat.color}`}>
                {cat.label}
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-brand-navy dark:text-slate-100 leading-snug mb-1">{complaint.title}</h1>
            <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Dilaporkan pada {formatDateTime(complaint.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button 
            onClick={() => router.push('/complaints')} 
            className="flex-1 md:flex-none px-5 py-2.5 border-[1.5px] border-gray-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold rounded-xl transition-colors text-xs"
          >
            Kembali
          </button>

          {isOwner && complaint.status === 'pending' && (
            <button
              onClick={() => handleUpdateStatus('processed')}
              disabled={isActionLoading}
              className="flex-1 md:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-xs shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5"
            >
              {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Proses Laporan
            </button>
          )}

          {isOwner && complaint.status !== 'resolved' && (
            <button
              onClick={() => handleUpdateStatus('resolved')}
              disabled={isActionLoading}
              className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-xs shadow-md shadow-emerald-500/10 flex items-center justify-center gap-1.5"
            >
              {isActionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Selesaikan Laporan
            </button>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Complaint Details & Photo */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Detailed Info Card */}
          <div className="bg-white dark:bg-[#0F172A] border-[1.5px] border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy dark:text-white mb-1">Informasi Laporan</h3>
            <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-6">Rincian ketidaknyamanan yang dilaporkan</p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 dark:text-[#94A3B8] uppercase tracking-wide">
                    <DoorOpen className="w-3.5 h-3.5" /> No. Kamar
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy dark:text-slate-200">
                    Kamar {complaint.room_number || '-'}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 dark:text-[#94A3B8] uppercase tracking-wide">
                    <User className="w-3.5 h-3.5" /> Pelapor (Penghuni)
                  </span>
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy dark:text-slate-200">
                    {complaint.tenant_name || '-'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 dark:text-[#94A3B8] uppercase tracking-wide">
                  Deskripsi Aduan
                </span>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-xs text-brand-navy/80 dark:text-white font-medium leading-relaxed">
                  {complaint.description}
                </div>
              </div>

              {/* Photo Proof */}
              {complaint.photo_url && (
                <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 dark:text-[#94A3B8] uppercase tracking-wide">
                    <ImageIcon className="w-3.5 h-3.5" /> Bukti Foto Pendukung
                  </span>
                  <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-video max-h-[360px] bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative group">
                    <img 
                      src={getImageUrl(complaint.photo_url)} 
                      alt="Bukti foto komplain" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Response, WA integration & Actions */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AI Response Card */}
          <div className="bg-white dark:bg-[#0F172A] border-[1.5px] border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy dark:text-white mb-1">Integrasi Sistem & AI</h3>
            <p className="text-xs text-gray-500 dark:text-[#94A3B8] mb-6">Tanggapan otomatis AI dan status WhatsApp grup</p>
            
            <div className="space-y-4">
              {/* Lapor Kos AI Response */}
              <div className="bg-brand-navy/5 dark:bg-indigo-950/40 border border-brand-navy/10 dark:border-indigo-900/50 rounded-2xl p-4 text-xs font-medium text-brand-navy/80 dark:text-white leading-relaxed">
                <div className="text-[9px] font-bold text-brand-navy dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-teal" /> Tanggapan Lapor Kos AI (Untuk Pelapor)
                </div>
                {complaint.ai_response ? (
                  <span className="italic">"{complaint.ai_response}"</span>
                ) : (
                  <span className="text-slate-400 dark:text-[#94A3B8]">Tidak ada tanggapan otomatis AI untuk laporan ini.</span>
                )}
              </div>

              {/* WhatsApp Alert Status */}
              <div className={`border rounded-2xl p-4 text-xs font-medium leading-relaxed ${
                complaint.wa_sent 
                  ? 'bg-emerald-500/5 dark:bg-emerald-500/20 border-emerald-500/20 dark:border-emerald-500/40 text-brand-navy/80 dark:text-white' 
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-brand-navy/60 dark:text-[#94A3B8]'
              }`}>
                <div className="text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-emerald-500" /> Teguran Otomatis AI (Ke Grup WA)
                  </span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wider ${
                    complaint.wa_sent 
                      ? 'bg-emerald-500 text-white shadow-sm' 
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-[#94A3B8]'
                  }`}>
                    {complaint.wa_sent ? 'Terkirim' : 'Simulasi / Gagal'}
                  </span>
                </div>
                {complaint.wa_message ? (
                  <span className="italic">"{complaint.wa_message}"</span>
                ) : (
                  <span className="text-slate-400 dark:text-[#94A3B8]">Pesan teguran grup tidak dibuat atau belum dipicu.</span>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
