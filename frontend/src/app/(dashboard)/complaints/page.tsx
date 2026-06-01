'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_URL } from '@/lib/api';
import { 
  MessageSquare, 
  VolumeX, 
  Wrench, 
  Trash2, 
  ShieldAlert, 
  HelpCircle, 
  Image as ImageIcon, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Send,
  User,
  DoorOpen,
  Calendar,
  Settings,
  Upload,
  Info,
  X
} from 'lucide-react';

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

export default function ComplaintsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states (Tenant)
  const [category, setCategory] = useState('noisy');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState<Complaint | null>(null);

  // Owner Config states
  const [waGroupLink, setWaGroupLink] = useState('');
  const [isSavingWA, setIsSavingWA] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserAndComplaints();
  }, []);

  const fetchUserAndComplaints = async () => {
    setIsLoading(true);
    try {
      const userData = await apiFetch('/api/auth/me');
      setUser(userData);
      
      if (userData.role === 'owner') {
        setWaGroupLink(userData.whatsapp_group_link || '');
        const data = await apiFetch('/api/complaints');
        setComplaints(data);
      } else {
        const data = await apiFetch('/api/complaints/my');
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
      // Create local preview URL
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
      });
      alert('Tautan grup WhatsApp berhasil diperbarui!');
      // Update local user state
      setUser((prev: any) => ({ ...prev, whatsapp_group_link: waGroupLink }));
    } catch (err: any) {
      alert('Gagal menyimpan tautan grup WA: ' + err.message);
    } finally {
      setIsSavingWA(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      alert('Judul dan Deskripsi komplain wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      let photoUrl = '';

      // Upload file first if exists
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);

        const uploadData = await apiFetch('/api/complaints/upload', {
          method: 'POST',
          body: formData
        });
        photoUrl = uploadData.photo_url;
      }

      // Submit complaint JSON
      const resData = await apiFetch('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          category,
          photo_url: photoUrl || null
        })
      });

      setJustSubmitted(resData);
      // Reset form
      setTitle('');
      setDescription('');
      removePhoto();
      
      // Refresh complaints history
      const updatedComplaints = await apiFetch('/api/complaints/my');
      setComplaints(updatedComplaints);
    } catch (err: any) {
      alert('Gagal mengirimkan laporan komplain: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (complaintId: string, nextStatus: string) => {
    try {
      await apiFetch(`/api/complaints/${complaintId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus })
      });
      
      // Update local complaints state
      setComplaints((prev) => 
        prev.map((c) => c.id === complaintId ? { ...c, status: nextStatus } : c)
      );


    } catch (err: any) {
      alert('Gagal memperbarui status komplain: ' + err.message);
    }
  };

  const getCategoryDetails = (cat: string) => {
    switch (cat) {
      case 'noisy':
        return { label: 'Keributan', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: VolumeX };
      case 'facility':
        return { label: 'Fasilitas Rusak', color: 'text-rose-600 bg-rose-50 border-rose-100', icon: Wrench };
      case 'cleanliness':
        return { label: 'Kebersihan', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: Trash2 };
      case 'security':
        return { label: 'Keamanan', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: ShieldAlert };
      default:
        return { label: 'Lainnya', color: 'text-slate-600 bg-slate-50 border-slate-100', icon: HelpCircle };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Menunggu', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock };
      case 'processed':
        return { label: 'Diproses', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: RefreshCwIcon };
      default:
        return { label: 'Selesai', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 };
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

  const RefreshCwIcon = (props: any) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`animate-spin ${props.className}`}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-brand-cream/30">
        <div className="flex flex-col items-center gap-3">
          <RefreshCwIcon className="w-10 h-10 text-brand-navy" />
          <p className="font-semibold text-brand-navy/60 text-sm">Memuat data komplain...</p>
        </div>
      </div>
    );
  }

  const isTenant = user?.role === 'tenant';

  // Stats calculation for Owner
  const totalCount = complaints.length;
  const pendingCount = complaints.filter(c => c.status === 'pending').length;
  const processedCount = complaints.filter(c => c.status === 'processed').length;
  const resolvedCount = complaints.filter(c => c.status === 'resolved').length;

  const filteredComplaints = complaints.filter(c => {
    if (statusFilter === 'all') return true;
    return c.status === statusFilter;
  });

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest mb-1">LAYANAN ADUAN</p>
          <h1 className="text-3xl font-display font-bold text-brand-navy">
            {isTenant ? 'Komplain & Pengaduan' : 'Manajemen Komplain'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isTenant ? 'Laporkan ketidaknyamanan kos secara instan dan tanggap' : 'Kelola aduan kenyamanan kosan dari para penghuni'}
          </p>
        </div>
      </div>

      {isTenant ? (
        /* TENANT VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 relative">
          
          {/* Left: Complaint Form */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-brand-navy/5">
              <h2 className="text-xl font-display font-bold text-brand-navy mb-4">Buat Komplain Baru</h2>
              
              <form onSubmit={handleSubmitComplaint} className="space-y-4">
                
                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Kategori Masalah</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: 'noisy', label: 'Keributan', icon: VolumeX, color: 'hover:border-amber-400 hover:bg-amber-50/50', activeColor: 'border-amber-500 bg-amber-50 text-amber-900' },
                      { id: 'facility', label: 'Fasilitas', icon: Wrench, color: 'hover:border-rose-400 hover:bg-rose-50/50', activeColor: 'border-rose-500 bg-rose-50 text-rose-900' },
                      { id: 'cleanliness', label: 'Kebersihan', icon: Trash2, color: 'hover:border-emerald-400 hover:bg-emerald-50/50', activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                      { id: 'security', label: 'Keamanan', icon: ShieldAlert, color: 'hover:border-indigo-400 hover:bg-indigo-50/50', activeColor: 'border-indigo-500 bg-indigo-50 text-indigo-900' },
                      { id: 'other', label: 'Lainnya', icon: HelpCircle, color: 'hover:border-slate-400 hover:bg-slate-50/50', activeColor: 'border-slate-500 bg-slate-50 text-slate-900' }
                    ].map((item) => {
                      const Icon = item.icon;
                      const isActive = category === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCategory(item.id)}
                          className={`flex flex-col items-center justify-center p-3 rounded-2xl border-[1.5px] transition-all text-center gap-1.5 ${
                            isActive 
                              ? item.activeColor + ' shadow-sm font-bold scale-[1.03]' 
                              : 'border-slate-100 bg-slate-50/50 text-slate-600 ' + item.color
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[10px] tracking-tight">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-1.5">Judul Komplain</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Lampu koridor mati / Kamar 203 berisik"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-1.5">Detail Kejadian / Kerusakan</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Jelaskan detail permasalahan Anda secara lengkap di sini..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium resize-none"
                  />
                </div>

                {/* Photo Dropzone Preview Container (Interaktif & Seragam) */}
                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-1.5">Lampiran Foto (Opsional)</label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    id="complaint-photo-upload"
                  />
                  
                  {photoPreview ? (
                    /* Preview image container */
                    <div className="relative border-2 border-brand-teal rounded-2xl overflow-hidden bg-slate-50 aspect-video max-h-[160px] flex items-center justify-center shadow-md">
                      <img src={photoPreview} alt="Preview komplain" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-white text-slate-900 font-bold rounded-lg text-xs hover:bg-slate-100 transition-colors shadow"
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={removePhoto}
                          className="px-3 py-1.5 bg-rose-500 text-white font-bold rounded-lg text-xs hover:bg-rose-600 transition-colors shadow"
                        >
                          Hapus
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-2 right-2 p-1.5 bg-slate-950/80 hover:bg-slate-950 text-white rounded-full transition-colors shadow"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    /* Empty upload dropzone */
                    <label
                      htmlFor="complaint-photo-upload"
                      className="flex flex-col items-center justify-center border-[1.5px] border-dashed border-slate-200 hover:border-brand-navy bg-slate-50/50 hover:bg-white rounded-2xl py-6 cursor-pointer transition-all gap-1.5 group"
                    >
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-brand-navy transition-colors" />
                      <span className="text-xs font-bold text-slate-500 group-hover:text-brand-navy transition-colors">Pilih File Foto</span>
                      <span className="text-[10px] text-slate-400">PNG, JPG, JPEG maks. 5MB</span>
                    </label>
                  )}
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-brand-navy hover:bg-brand-navy-light dark:bg-brand-teal dark:hover:bg-brand-teal-light text-white dark:text-slate-950 font-bold rounded-2xl shadow-lg shadow-brand-navy/10 hover:shadow-brand-navy/20 dark:shadow-brand-teal/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCwIcon className="w-4 h-4" /> Mengirimkan...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Kirim Komplain
                    </>
                  )}
                </button>

              </form>
            </div>

            {/* AI Response chat widget if just submitted */}
            {justSubmitted && (
              <div className="bg-gradient-to-tr from-brand-navy to-slate-900 text-white rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-4 translate-y-4">
                  <MessageSquare className="w-40 h-40" />
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-white/50">Lapor Kos AI Assistant</span>
                  </div>
                  <button 
                    onClick={() => setJustSubmitted(null)} 
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 bg-brand-cream/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 font-display font-bold text-brand-cream text-lg">
                    AI
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="bg-white/10 rounded-2xl rounded-tl-none p-4 text-sm font-medium leading-relaxed">
                      {justSubmitted.ai_response}
                    </div>

                    {justSubmitted.wa_sent && (
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Teguran otomatis telah dikirim ke WhatsApp Group Kosan.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: History Complaints */}
          <div className="lg:col-span-5 flex flex-col min-h-[400px]">
            <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-brand-navy/5 flex-1 flex flex-col">
              <h2 className="text-xl font-display font-bold text-brand-navy mb-4">Riwayat Komplain Anda</h2>
              
              <div className="space-y-3">
                {complaints.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                    <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
                    <p className="font-semibold text-sm">Belum ada riwayat komplain</p>
                    <p className="text-xs max-w-[200px] mt-1">Komplain yang Anda kirim akan tercatat rapi di sini.</p>
                  </div>
                ) : (
                  complaints.map((item) => {
                    const cat = getCategoryDetails(item.category);
                    const status = getStatusBadge(item.status);
                    const StatusIcon = status.icon;
                    return (
                      <div 
                        key={item.id}
                        onClick={() => router.push(`/complaints/${item.id}`)}
                        className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${cat.color}`}>
                            {cat.label}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${status.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </span>
                        </div>
                        
                        <h3 className="font-bold text-brand-navy text-sm mb-1">{item.title}</h3>
                        <p className="text-xs text-brand-navy/60 font-medium line-clamp-2 mb-3">{item.description}</p>
                        
                        {item.photo_url && (
                          <div className="mb-3 max-w-[120px] rounded-lg overflow-hidden border border-slate-200">
                            <img src={`${API_URL}${item.photo_url}`} alt="Bukti" className="w-full h-16 object-cover" />
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {formatDateTime(item.created_at)}</span>
                        </div>

                        {item.ai_response && (
                          <div className="mt-3 bg-white border border-slate-100 rounded-xl p-3 text-[11px] font-medium text-slate-600 leading-relaxed">
                            <div className="text-[9px] font-bold text-brand-navy/40 uppercase tracking-wider mb-1">Respons Lapor Kos AI</div>
                            {item.ai_response}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* OWNER VIEW */
        <div className="z-10 relative space-y-6">
          
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 'all', label: 'SEMUA LAPORAN', value: totalCount, icon: MessageSquare, iconColor: 'text-brand-navy', bgColor: 'bg-gray-50', hoverColor: 'group-hover:bg-brand-navy' },
              { id: 'pending', label: 'MENUNGGU TINDAKAN', value: pendingCount, icon: Clock, iconColor: 'text-amber-500', bgColor: 'bg-amber-50', hoverColor: 'group-hover:bg-amber-500' },
              { id: 'processed', label: 'SEDANG DIPROSES', value: processedCount, icon: RefreshCwIcon, iconColor: 'text-blue-500', bgColor: 'bg-blue-50', hoverColor: 'group-hover:bg-blue-500' },
              { id: 'resolved', label: 'LAPORAN SELESAI', value: resolvedCount, icon: CheckCircle2, iconColor: 'text-emerald-500', bgColor: 'bg-emerald-50', hoverColor: 'group-hover:bg-emerald-500' }
            ].map((stat, i) => {
              const StatIcon = stat.icon;
              const isActive = statusFilter === stat.id;
              
              // Jika status sedang aktif, kita paksa warna bar atas sesuai hoverColor
              const activeBarColor = stat.hoverColor.replace('group-hover:', '');
              
              return (
                <button 
                  key={i} 
                  onClick={() => setStatusFilter(stat.id)}
                  className={`bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden text-left ${
                    isActive ? 'ring-2 ring-brand-navy/10 border-brand-navy/30 scale-[1.02]' : 'hover:scale-[1.02]'
                  }`}
                >
                  {/* Top Accent Bar */}
                  <div className={`absolute top-0 left-0 w-full h-[3px] transition-colors duration-300 ${isActive ? activeBarColor : 'bg-gray-200 ' + stat.hoverColor}`}></div>
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bgColor} ${stat.iconColor} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                      <StatIcon className="w-5 h-5" />
                    </div>
                    {isActive ? (
                      <span className="text-[10px] font-bold text-brand-navy bg-brand-navy/10 px-2.5 py-0.5 rounded-full animate-in fade-in zoom-in duration-300">
                        Difilter
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2.5 py-0.5 rounded-full">
                        Status
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-3xl font-display font-bold text-brand-navy">{stat.value}</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-3">Laporan {stat.id === 'all' ? 'seluruh aduan' : stat.id === 'pending' ? 'menunggu respon' : stat.id === 'processed' ? 'dalam penanganan' : 'telah diselesaikan'}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: WA Group Config & Filters */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* WhatsApp Config Card */}
              <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-brand-navy/5">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-brand-navy" />
                  <h2 className="text-lg font-display font-bold text-brand-navy">Integrasi WhatsApp</h2>
                </div>
                
                <form onSubmit={handleSaveWhatsAppGroup} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">ID Grup WhatsApp (Fonnte)</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 12036315xxxx (Group ID dari Fonnte)"
                      value={waGroupLink}
                      onChange={(e) => setWaGroupLink(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium"
                    />
                    <span className="text-[10px] text-slate-400 mt-1.5 flex gap-1 items-start leading-relaxed font-medium">
                      <Info className="w-3.5 h-3.5 shrink-0 text-slate-400 mt-0.5" />
                      Masukkan Group ID yang didapat dari Dashboard Fonnte (bukan link tautan invite). Bot WA harus berada di dalam grup tersebut.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingWA}
                    className="w-full py-2.5 bg-brand-navy hover:bg-brand-navy-light text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
                  >
                    {isSavingWA ? (
                      <>
                        <RefreshCwIcon className="w-3.5 h-3.5" /> Menyimpan...
                      </>
                    ) : (
                      'Simpan Tautan'
                    )}
                  </button>
                </form>
              </div>

              {/* Status Filters */}
              <div className="bg-white/90 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-brand-navy/5">
                <h2 className="text-lg font-display font-bold text-brand-navy mb-3">Filter Status</h2>
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'all', label: 'Semua Komplain' },
                    { id: 'pending', label: 'Menunggu Tindakan' },
                    { id: 'processed', label: 'Sedang Diproses' },
                    { id: 'resolved', label: 'Selesai' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setStatusFilter(filter.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        statusFilter === filter.id 
                          ? 'bg-brand-navy text-white shadow-md' 
                          : 'bg-slate-50 hover:bg-slate-100 text-brand-navy/60'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Complaints List for Owner */}
            <div className="lg:col-span-8">
              <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-xl shadow-brand-navy/5 min-h-[450px] flex flex-col">
                <h2 className="text-xl font-display font-bold text-brand-navy mb-4">Daftar Pengaduan Penghuni</h2>
                
                <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                  {filteredComplaints.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 min-h-[300px]">
                      <MessageSquare className="w-12 h-12 text-slate-300 mb-2" />
                      <p className="font-semibold text-sm">Tidak ada laporan komplain</p>
                      <p className="text-xs max-w-[240px] mt-1">Seluruh komplain yang diajukan oleh penyewa sesuai filter akan muncul di sini.</p>
                    </div>
                  ) : (
                    filteredComplaints.map((item) => {
                      const cat = getCategoryDetails(item.category);
                      const CategoryIcon = cat.icon;
                      const status = getStatusBadge(item.status);
                      const StatusIcon = status.icon;
                      return (
                        <div
                          key={item.id}
                          onClick={() => router.push(`/complaints/${item.id}`)}
                          className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-2xl p-4 transition-all cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-bold text-brand-navy bg-brand-navy/5 px-2 py-1 rounded-md flex items-center gap-1.5">
                                <DoorOpen className="w-3.5 h-3.5 text-brand-navy/60" /> Kamar {item.room_number}
                              </span>
                              <span className="text-[10px] font-bold text-brand-navy bg-brand-navy/5 px-2 py-1 rounded-md flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-brand-navy/60" /> {item.tenant_name}
                              </span>
                              {item.photo_url && (
                                <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2 py-1 rounded-md flex items-center gap-1.5 border border-brand-teal/20">
                                  <ImageIcon className="w-3.5 h-3.5" /> Ada Foto
                                </span>
                              )}
                            </div>
                            
                            <h3 className="font-bold text-brand-navy text-base truncate">{item.title}</h3>
                            <p className="text-xs text-brand-navy/60 font-medium line-clamp-2 leading-relaxed">{item.description}</p>
                            
                            <div className="flex items-center gap-3 pt-2">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-md border flex items-center gap-1.5 ${cat.color}`}>
                                <CategoryIcon className="w-3.5 h-3.5" />
                                {cat.label}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDateTime(item.created_at)}
                              </span>
                              {item.ai_response && (
                                <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md flex items-center gap-1.5 ml-auto border border-indigo-100">
                                  <MessageSquare className="w-3.5 h-3.5" /> AI Merespons
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2.5 shrink-0 ml-4">
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 shadow-sm ${status.color}`}>
                              <StatusIcon className="w-4 h-4" />
                              {status.label}
                            </span>
                            {item.wa_sent && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                WA Terkirim
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
