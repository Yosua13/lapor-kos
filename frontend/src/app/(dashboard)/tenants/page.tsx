'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Loader2,
  Users,
  X,
  Phone,
  Calendar,
  Image as ImageIcon,
  User,
  ArrowUpRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  phone: string;
  room_id: string;
  ktp_url: string;
  selfie_url: string;
  entry_date: string;
  room?: {
    room_number: string;
    status: string;
  };
}

export default function TenantsPage() {
  const [mounted, setMounted] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    room_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    rental_duration: '1',
  });
  const [files, setFiles] = useState<{ktp: File | null, selfie: File | null}>({
    ktp: null,
    selfie: null
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tenantsData, roomsData] = await Promise.all([
        apiFetch('/api/tenants'),
        apiFetch('/api/rooms')
      ]);
      setTenants(tenantsData || []);
      setRooms(roomsData || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'selfie') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === '' || val === '+62' || val === '+62-') {
      setFormData({ ...formData, phone: '' });
      return;
    }
    
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('62')) {
      digits = digits.slice(2);
    } else if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 12);

    let formatted = '';
    if (digits.length > 0) {
      formatted = '+62';
      formatted += '-' + digits.slice(0, 3);
      if (digits.length > 3) {
        formatted += '-' + digits.slice(3, 7);
      }
      if (digits.length > 7) {
        formatted += '-' + digits.slice(7, 12);
      }
    }
    setFormData({ ...formData, phone: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || formData.name.trim() === '') {
      alert('Nama Lengkap wajib diisi.');
      return;
    }
    if (!formData.phone || formData.phone.trim() === '') {
      alert('Nomor HP / WA wajib diisi.');
      return;
    }
    const rawDigits = formData.phone.replace(/\D/g, '');
    if (rawDigits.length - 2 < 10) {
      alert('Nomor HP / WA minimal harus 10 digit angka.');
      return;
    }
    if (!formData.room_id || formData.room_id.trim() === '') {
      alert('Kamar wajib dipilih.');
      return;
    }
    if (!formData.entry_date || formData.entry_date.trim() === '') {
      alert('Tanggal Masuk wajib diisi.');
      return;
    }
    if (!files.ktp) {
      alert('Dokumen KTP wajib diupload.');
      return;
    }
    if (!files.selfie) {
      alert('Foto Selfie wajib diupload.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('phone', formData.phone);
      data.append('room_id', formData.room_id);
      data.append('entry_date', formData.entry_date);
      data.append('rental_duration', formData.rental_duration);
      if (files.ktp) data.append('ktp', files.ktp);
      if (files.selfie) data.append('selfie', files.selfie);

      // Using raw fetch for FormData
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch('http://localhost:8081/api/tenants', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      if (!response.ok) throw new Error('Gagal menambah penghuni');
      
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus data penghuni ini?')) return;
    try {
      await apiFetch(`/api/tenants/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8 animate-slide-up max-w-[1400px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">RESIKO & PENGHUNI</p>
          <h1 className="text-4xl font-display font-bold text-brand-navy">Data Penghuni</h1>
          <p className="text-brand-navy/40 text-sm mt-1">Daftar penghuni aktif dan riwayat dokumen identitas.</p>
        </div>
        <button 
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-brand-teal hover:bg-brand-teal-light text-white text-sm font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-brand-teal/30 transition-all flex items-center gap-2 group w-fit"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          <span>Tambah Penghuni</span>
        </button>
      </header>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="glass-panel p-8 rounded-[32px] flex items-center gap-6">
            <div className="w-16 h-16 bg-brand-teal/10 rounded-[24px] flex items-center justify-center text-brand-teal shadow-inner">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em] mb-1">Total Penghuni Aktif</p>
              <h4 className="text-3xl font-display font-bold text-brand-navy">{tenants.length} <span className="text-sm text-brand-navy/20 uppercase font-bold tracking-widest ml-1">Orang</span></h4>
            </div>
         </div>
         <div className="glass-panel p-8 rounded-[32px] flex items-center gap-6">
            <div className="w-16 h-16 bg-orange-500/10 rounded-[24px] flex items-center justify-center text-orange-500 shadow-inner">
              <Calendar className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em] mb-1">Masuk Bulan Ini</p>
              <h4 className="text-3xl font-display font-bold text-brand-navy">0 <span className="text-sm text-brand-navy/20 uppercase font-bold tracking-widest ml-1">Penghuni Baru</span></h4>
            </div>
         </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-full py-24 text-center">
            <Loader2 className="w-12 h-12 animate-spin text-brand-teal mx-auto mb-4" />
            <p className="text-brand-navy/40 font-bold text-xs uppercase tracking-widest">Sinkronisasi Data...</p>
          </div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full py-24 text-center glass-panel rounded-[40px]">
             <div className="w-20 h-20 bg-brand-navy/5 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-brand-navy/10">
                <Users className="w-10 h-10" />
             </div>
             <p className="text-brand-navy font-bold text-lg">Belum Ada Penghuni</p>
             <p className="text-brand-navy/30 text-sm mt-1">Data penghuni akan muncul setelah Anda menautkan kamar.</p>
          </div>
        ) : (
          tenants.map((tenant, i) => (
            <div 
              key={tenant.id} 
              className="glass-panel glass-panel-hover p-8 rounded-[40px] animate-slide-up relative overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="absolute top-6 right-6">
                 <button 
                  onClick={() => handleDelete(tenant.id)}
                  className="p-2.5 text-brand-navy/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>

              <div className="flex items-center gap-5 mb-8">
                 <div className="w-16 h-16 bg-brand-navy/5 rounded-[24px] flex items-center justify-center text-brand-teal border border-brand-navy/5 overflow-hidden shadow-inner">
                    {tenant.selfie_url ? (
                      <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7" />
                    )}
                 </div>
                 <div>
                    <h4 className="text-xl font-display font-bold text-brand-navy leading-tight">{tenant.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                       <span className="inline-block px-2 py-0.5 bg-brand-teal/10 text-brand-teal text-[9px] font-bold uppercase tracking-[0.1em] rounded-md">
                         {tenant.room?.room_number ? `Kamar ${tenant.room.room_number}` : 'BELUM ADA KAMAR'}
                       </span>
                    </div>
                 </div>
              </div>

              <div className="space-y-4 py-6 border-y border-brand-navy/5 mb-8">
                 <div className="flex items-center gap-3 text-sm text-brand-navy/60 font-medium">
                    <div className="w-8 h-8 bg-brand-navy/5 rounded-lg flex items-center justify-center">
                       <Phone className="w-4 h-4 text-brand-navy/20" />
                    </div>
                    <span>{tenant.phone || '-'}</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-brand-navy/60 font-medium">
                    <div className="w-8 h-8 bg-brand-navy/5 rounded-lg flex items-center justify-center">
                       <Calendar className="w-4 h-4 text-brand-navy/20" />
                    </div>
                    <span>Sejak {new Date(tenant.entry_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <a 
                   href={`http://localhost:8081${tenant.ktp_url}`} 
                   target="_blank" 
                   className="flex items-center justify-center gap-2 py-3 bg-brand-navy/5 hover:bg-brand-navy/10 text-[10px] font-bold text-brand-navy uppercase tracking-[0.2em] rounded-2xl transition-all group/link"
                 >
                   <ImageIcon className="w-3.5 h-3.5 opacity-30" />
                   <span>DOKUMEN KTP</span>
                   <ArrowUpRight className="w-3 h-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                 </a>
                 <a 
                   href={`/tenants/${tenant.id}`}
                   className="flex items-center justify-center gap-2 py-3 bg-brand-teal/5 hover:bg-brand-teal/10 text-[10px] font-bold text-brand-teal uppercase tracking-[0.2em] rounded-2xl transition-all"
                 >
                   <span>DETAIL PROFIL</span>
                 </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal rendered via Portal to escape parent CSS stacking contexts */}
      {isModalOpen && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-500 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{ 
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(6px)', 
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(11, 31, 53, 0.45)',
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none' 
          }}
        >
          <div className="bg-white rounded-[32px] pt-8 px-8 pb-0 max-w-[620px] w-full shadow-[0_20px_60px_rgba(15,23,42,0.2)] border border-brand-navy/10 relative my-auto animate-slide-up flex flex-col max-h-[90vh] overflow-hidden">
            {/* Tombol Close */}
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-brand-navy transition-colors p-2 rounded-full hover:bg-gray-100 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Modal Header */}
            <div className="mb-6 shrink-0">
               <span className="inline-block px-2.5 py-1 bg-brand-teal/10 text-brand-teal text-[10px] font-extrabold uppercase tracking-widest rounded-md mb-2">
                 REGISTRASI PENGHUNI
               </span>
               <h3 className="text-2xl font-display font-bold text-brand-navy leading-tight">Tambah Penghuni Baru</h3>
               <p className="text-gray-500 text-xs mt-1 font-medium">Lengkapi data identitas dan dokumen pendukung</p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
              {/* Scrollable Form Body */}
              <div 
                className="space-y-6 overflow-y-auto pr-2 flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {/* GRUP 1: DATA DIRI */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DATA DIRI</span>
                    <div className="h-[1.5px] w-full bg-gray-200"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Nama Lengkap */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="E.g. Andi Setiawan"
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                      />
                      <p className="text-[10px] text-gray-500 font-medium">Sesuai KTP</p>
                    </div>

                    {/* Nomor HP/WA */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">
                        Nomor HP / WA <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        value={formData.phone}
                        onChange={handlePhoneChange}
                        placeholder="+62-8xx-xxxx-xxxx"
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                      />
                      <p className="text-[10px] text-gray-500 font-medium">Nomor aktif yang bisa dihubungi</p>
                    </div>
                  </div>
                </div>

                {/* GRUP 2: DATA KAMAR */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DATA KAMAR</span>
                    <div className="h-[1.5px] w-full bg-gray-200"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    {/* Pilih Kamar Tersedia */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">
                        Kamar Tersedia <span className="text-red-500">*</span>
                      </label>
                      <select 
                        required
                        value={formData.room_id}
                        onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="">— Pilih Kamar —</option>
                        {rooms.filter(r => r.status === 'available').map(room => (
                          <option key={room.id} value={room.id}>Kamar {room.room_number}</option>
                        ))}
                      </select>

                      {/* Info Card Kamar Terpilih */}
                      {(() => {
                        const selectedRoom = rooms.find(r => r.id === formData.room_id);
                        if (!selectedRoom) return null;
                        return (
                          <div className="bg-[#f0faf8] border-[1.5px] border-brand-teal/60 rounded-[9px] p-2.5 mt-2 flex justify-between items-center animate-slide-up shadow-sm">
                            <div className="pr-2">
                              <p className="text-[11px] font-bold text-brand-navy leading-none">Kamar {selectedRoom.room_number}</p>
                              <p className="text-[9px] text-brand-navy/70 font-medium line-clamp-1 mt-1">{selectedRoom.description || 'Lantai standar • Fasilitas lengkap'}</p>
                            </div>
                            <p className="text-xs font-bold text-brand-teal shrink-0">
                              Rp {selectedRoom.price_per_month?.toLocaleString('id-ID')}
                              <span className="text-[8px] font-normal text-brand-navy/50">/bln</span>
                            </p>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Tanggal Masuk */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">
                        Tanggal Masuk <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="date" 
                        required
                        value={formData.entry_date}
                        onChange={(e) => setFormData({...formData, entry_date: e.target.value})}
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm"
                      />
                      <p className="text-[10px] text-gray-500 font-medium">Awal periode kontrak</p>
                    </div>

                    {/* Durasi Sewa */}
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">
                        Durasi Sewa <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={formData.rental_duration}
                        onChange={(e) => setFormData({...formData, rental_duration: e.target.value})}
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all cursor-pointer shadow-sm"
                      >
                        <option value="1">1 Bulan</option>
                        <option value="3">3 Bulan</option>
                        <option value="6">6 Bulan</option>
                        <option value="12">12 Bulan (1 Tahun)</option>
                      </select>
                      <p className="text-[10px] text-gray-500 font-medium">Jangka waktu kontrak sewa</p>
                    </div>
                  </div>
                </div>

                {/* GRUP 3: DOKUMEN IDENTITAS */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DOKUMEN IDENTITAS</span>
                    <div className="h-[1.5px] w-full bg-gray-200"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                    {/* Dokumen KTP */}
                    <div className="space-y-1">
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'ktp')}
                          className="hidden" 
                          id="ktp-upload"
                        />
                        <label 
                          htmlFor="ktp-upload"
                          className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${
                            files.ktp 
                              ? 'border-green-500 bg-[#f0faf8]' 
                              : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'
                          }`}
                        >
                          {files.ktp && (
                            <span className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Terupload
                            </span>
                          )}
                          <div className="text-2xl mb-1">
                            {files.ktp ? '✅' : '🪪'}
                          </div>
                          <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">
                            {files.ktp ? 'Dokumen KTP' : 'Dokumen KTP'} <span className="text-red-500">*</span>
                          </p>
                          <p className={`text-[9px] text-center ${files.ktp ? 'text-green-600 font-semibold truncate max-w-[140px]' : 'text-gray-500 font-medium'}`}>
                            {files.ktp ? files.ktp.name : 'Klik untuk pilih foto'}
                          </p>
                          {!files.ktp && <p className="text-[8px] text-gray-400 mt-0.5 text-center">JPG / PNG • maks. 5 MB</p>}
                        </label>
                      </div>
                    </div>

                    {/* Foto Selfie */}
                    <div className="space-y-1">
                      <div className="relative">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => handleFileChange(e, 'selfie')}
                          className="hidden" 
                          id="selfie-upload"
                        />
                        <label 
                          htmlFor="selfie-upload"
                          className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${
                            files.selfie 
                              ? 'border-green-500 bg-[#f0faf8]' 
                              : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'
                          }`}
                        >
                          {files.selfie && (
                            <span className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              Terupload
                            </span>
                          )}
                          <div className="text-2xl mb-1">
                            {files.selfie ? '✅' : '🤳'}
                          </div>
                          <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">
                            {files.selfie ? 'Foto Selfie' : 'Foto Selfie'} <span className="text-red-500">*</span>
                          </p>
                          <p className={`text-[9px] text-center ${files.selfie ? 'text-green-600 font-semibold truncate max-w-[140px]' : 'text-gray-500 font-medium'}`}>
                            {files.selfie ? files.selfie.name : 'Klik untuk pilih foto'}
                          </p>
                          {!files.selfie && <p className="text-[8px] text-gray-400 mt-0.5 text-center">Selfie pegang KTP • maks. 5 MB</p>}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="bg-[#faf8f5] border-t border-gray-200 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                <span className="text-[10px] text-gray-500 font-medium">
                  <span className="text-red-500">*</span> Field wajib diisi
                </span>
                <div className="flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border-[1.5px] border-gray-300 hover:border-gray-400 text-brand-navy font-bold rounded-[9px] transition-all text-xs bg-white shadow-sm"
                  >
                    Batal
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-[9px] shadow-md shadow-brand-teal/20 transition-all flex items-center gap-2 text-xs"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span className="font-bold">✓</span>
                    )}
                    <span>Simpan Data Penghuni</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
