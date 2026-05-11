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
  User
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
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-navy">Data Penghuni</h1>
          <p className="text-text-mid mt-1">Daftar penghuni yang aktif maupun riwayat di kos Anda.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-teal hover:bg-teal-light text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Penghuni</span>
        </button>
      </header>

      {/* Stats Summary */}
      <div className="bg-white p-2 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-gray-50">
         <div className="flex-1 p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-teal/10 rounded-2xl flex items-center justify-center text-teal">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-text-muted font-medium">Total Penghuni</p>
              <h4 className="text-xl font-bold text-navy">{tenants.length} Orang</h4>
            </div>
         </div>
         <div className="flex-1 p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-text-muted font-medium">Masuk Bulan Ini</p>
              <h4 className="text-xl font-bold text-navy">2 Orang</h4>
            </div>
         </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-teal mx-auto" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100">
             <p className="text-text-muted">Belum ada data penghuni.</p>
          </div>
        ) : (
          tenants.map((tenant) => (
            <div key={tenant.id} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl hover:shadow-navy/5 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => handleDelete(tenant.id)}
                  className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>
              </div>

              <div className="flex items-center gap-4 mb-6">
                 <div className="w-14 h-14 bg-cream rounded-2xl flex items-center justify-center text-teal border border-teal/10 overflow-hidden">
                    {tenant.selfie_url ? (
                      <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6" />
                    )}
                 </div>
                 <div>
                    <h4 className="font-bold text-navy text-lg">{tenant.name}</h4>
                    <span className="inline-block px-2 py-0.5 bg-navy/5 text-navy text-[10px] font-bold uppercase tracking-wider rounded">
                      {tenant.room?.room_number ? `Kamar ${tenant.room.room_number}` : 'Belum Ada Kamar'}
                    </span>
                 </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-50">
                 <div className="flex items-center gap-3 text-sm text-text-mid">
                    <Phone className="w-4 h-4 text-text-muted" />
                    <span>{tenant.phone || '-'}</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-text-mid">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <span>Masuk: {new Date(tenant.entry_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</span>
                 </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                 <a 
                   href={`http://localhost:8081${tenant.ktp_url}`} 
                   target="_blank" 
                   className="flex items-center justify-center gap-2 py-2.5 bg-cream/50 hover:bg-cream text-[11px] font-bold text-navy uppercase tracking-wider rounded-xl transition-all"
                 >
                   <ImageIcon className="w-3 h-3" />
                   <span>Lihat KTP</span>
                 </a>
                 <button className="flex items-center justify-center gap-2 py-2.5 bg-teal/5 hover:bg-teal/10 text-[11px] font-bold text-teal uppercase tracking-wider rounded-xl transition-all">
                   <span>Detail</span>
                 </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <div className="bg-white rounded-3xl p-8 max-w-[600px] w-full shadow-2xl relative my-8 animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-text-muted hover:text-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h3 className="font-serif text-2xl text-navy mb-2">Tambah Penghuni Baru</h3>
            <p className="text-text-mid text-sm mb-8">Lengkapi data identitas dan dokumen penghuni.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Masukkan nama lengkap"
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3.5 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Nomor HP/WA</label>
                  <input 
                    type="text" 
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="0812xxxx"
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3.5 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Pilih Kamar</label>
                  <select 
                    value={formData.room_id}
                    onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3.5 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  >
                    <option value="">Pilih Kamar</option>
                    {rooms.filter(r => r.status === 'available').map(room => (
                      <option key={room.id} value={room.id}>Kamar {room.room_number}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Tanggal Masuk</label>
                  <input 
                    type="date" 
                    required
                    value={formData.entry_date}
                    onChange={(e) => setFormData({...formData, entry_date: e.target.value})}
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3.5 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Foto KTP</label>
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
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-teal cursor-pointer transition-all bg-cream/10"
                    >
                      <ImageIcon className="w-8 h-8 text-text-muted mb-2" />
                      <span className="text-xs text-text-mid">{files.ktp ? files.ktp.name : 'Upload Foto KTP'}</span>
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Foto Selfie</label>
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
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 hover:border-teal cursor-pointer transition-all bg-cream/10"
                    >
                      <ImageIcon className="w-8 h-8 text-text-muted mb-2" />
                      <span className="text-xs text-text-mid">{files.selfie ? files.selfie.name : 'Upload Foto Selfie'}</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-cream hover:bg-gray-200 text-navy font-semibold py-4 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center justify-center gap-2"
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
