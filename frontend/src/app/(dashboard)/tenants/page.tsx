'use client';

import { useState, useEffect } from 'react';
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
    fetchData();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'selfie') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('phone', formData.phone);
      data.append('room_id', formData.room_id);
      data.append('entry_date', formData.entry_date);
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
                 <button className="flex items-center justify-center gap-2 py-3 bg-brand-teal/5 hover:bg-brand-teal/10 text-[10px] font-bold text-brand-teal uppercase tracking-[0.2em] rounded-2xl transition-all">
                   <span>DETAIL PROFIL</span>
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-navy/40 backdrop-blur-sm animate-in fade-in duration-500 overflow-y-auto">
          <div className="bg-white rounded-[40px] p-10 max-w-[650px] w-full shadow-2xl relative my-8 animate-slide-up">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-brand-navy/20 hover:text-brand-navy transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="mb-10">
               <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">REGISTRASI PENGHUNI</p>
               <h3 className="text-3xl font-display font-bold text-brand-navy">Tambah Penghuni Baru</h3>
               <p className="text-brand-navy/40 text-sm mt-1">Lengkapi data identitas dan dokumen pendukung.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="E.g. Andi Setiawan"
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-semibold focus:ring-2 focus:ring-brand-teal/20 transition-all placeholder:text-brand-navy/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Nomor HP/WA</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="0812xxxx"
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-semibold focus:ring-2 focus:ring-brand-teal/20 transition-all placeholder:text-brand-navy/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Pilih Kamar Tersedia</label>
                  <select 
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-bold focus:ring-2 focus:ring-brand-teal/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Pilih Kamar</option>
                    {rooms.filter(r => r.status === 'available').map(room => (
                      <option key={room.id} value={room.id}>Kamar {room.room_number}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Tanggal Masuk</label>
                  <input 
                    type="date" 
                    required
                    value={formData.entry_date}
                    onChange={(e) => setFormData({...formData, entry_date: e.target.value})}
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-bold focus:ring-2 focus:ring-brand-teal/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Dokumen KTP</label>
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
                      className="flex flex-col items-center justify-center border-2 border-dashed border-brand-navy/10 rounded-[24px] p-6 hover:border-brand-teal hover:bg-brand-teal/5 cursor-pointer transition-all bg-brand-navy/5 group/file"
                    >
                      <ImageIcon className="w-8 h-8 text-brand-navy/20 mb-2 group-hover/file:text-brand-teal transition-colors" />
                      <span className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest text-center">{files.ktp ? files.ktp.name : 'Pilih Foto KTP'}</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Foto Selfie</label>
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
                      className="flex flex-col items-center justify-center border-2 border-dashed border-brand-navy/10 rounded-[24px] p-6 hover:border-brand-teal hover:bg-brand-teal/5 cursor-pointer transition-all bg-brand-navy/5 group/file"
                    >
                      <ImageIcon className="w-8 h-8 text-brand-navy/20 mb-2 group-hover/file:text-brand-teal transition-colors" />
                      <span className="text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest text-center">{files.selfie ? files.selfie.name : 'Pilih Foto Selfie'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-widest"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-brand-teal hover:bg-brand-teal-light text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-teal/30 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>Simpan Data Penghuni</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
