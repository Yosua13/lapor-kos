'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Edit2, 
  Phone, 
  Calendar, 
  Image as ImageIcon,
  User,
  DoorOpen,
  Loader2,
  Save,
  X,
  CreditCard,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  UploadCloud
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
  rental_duration: number;
  created_at: string;
  room?: {
    id: string;
    room_number: string;
    price_per_month: number;
    description: string;
    status: string;
  };
}

interface Room {
  id: string;
  room_number: string;
  price_per_month: number;
  description: string;
  status: string;
}

export default function TenantProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [mounted, setMounted] = useState(false);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{show: boolean, message: string, type: 'success' | 'error'}>({ show: false, message: '', type: 'success' });
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    room_id: '',
    entry_date: '',
    rental_duration: 1
  });
  const [files, setFiles] = useState<{ ktp: File | null, selfie: File | null }>({
    ktp: null,
    selfie: null
  });

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [tenantData, roomsData] = await Promise.all([
        apiFetch(`/api/tenants/${id}`),
        apiFetch('/api/rooms')
      ]);
      setTenant(tenantData);
      setRooms(roomsData || []);
      setFormData({
        name: tenantData.name,
        phone: tenantData.phone,
        room_id: tenantData.room_id || '',
        entry_date: tenantData.entry_date ? tenantData.entry_date.split('T')[0] : '',
        rental_duration: tenantData.rental_duration || 1
      });
    } catch (err: any) {
      alert(err.message || 'Gagal memuat detail penghuni');
      router.push('/tenants');
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

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === '' || val === '+62' || val === '+62-') {
      setFormData({ ...formData, phone: '' });
      return;
    }
    let digits = val.replace(/\D/g, '');
    if (digits.startsWith('62')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    digits = digits.slice(0, 12);

    let formatted = '';
    if (digits.length > 0) {
      formatted = '+62';
      formatted += '-' + digits.slice(0, 3);
      if (digits.length > 3) formatted += '-' + digits.slice(3, 7);
      if (digits.length > 7) formatted += '-' + digits.slice(7, 12);
    }
    setFormData({ ...formData, phone: formatted });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'selfie') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch(`http://localhost:8081/api/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Gagal menghapus penghuni');
      router.push('/tenants');
    } catch (err: any) {
      showToast(err.message, 'error');
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Nama wajib diisi'); return; }
    if (!formData.phone.trim()) { alert('Nomor HP wajib diisi'); return; }

    setIsSaving(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('phone', formData.phone);
      data.append('room_id', formData.room_id);
      data.append('entry_date', formData.entry_date);
      data.append('rental_duration', String(formData.rental_duration));
      if (files.ktp) data.append('ktp', files.ktp);
      if (files.selfie) data.append('selfie', files.selfie);

      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch(`http://localhost:8081/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });

      if (!response.ok) throw new Error('Gagal memperbarui profil');
      
      setIsEditing(false);
      setFiles({ ktp: null, selfie: null });
      fetchData();
      showToast('Profil berhasil diperbarui!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted || isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-12 h-12 animate-spin text-brand-teal mb-4" />
      <p className="text-brand-navy/40 font-bold text-xs uppercase tracking-widest">Memuat Profil...</p>
    </div>
  );

  if (!tenant) return null;

  // Calculations
  const entryDateObj = new Date(tenant.entry_date);
  const endDateObj = new Date(entryDateObj);
  endDateObj.setMonth(endDateObj.getMonth() + tenant.rental_duration);
  const isContractActive = endDateObj >= new Date();
  const contractStatus = isContractActive ? 'Aktif' : 'Kontrak Habis';
  const contractStatusColor = isContractActive ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50';
  const totalPembayaran = tenant.room ? tenant.room.price_per_month * tenant.rental_duration : 0;
  const initials = tenant.name.substring(0, 2).toUpperCase();

  // Mock Activities (Combining real created_at with mock payments)
  const activities = [
    {
      id: 1,
      title: 'Pembayaran Lunas',
      subtitle: `Rp ${totalPembayaran.toLocaleString('id-ID')} - Transfer BCA`,
      date: new Date(tenant.entry_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
      color: 'bg-green-100'
    },
    {
      id: 2,
      title: 'Kontrak Dibuat',
      subtitle: `Periode ${tenant.rental_duration} bulan dimulai`,
      date: new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <Clock className="w-4 h-4 text-brand-teal" />,
      color: 'bg-brand-teal/10'
    }
  ];

  if (!tenant.selfie_url || !tenant.ktp_url) {
    activities.push({
      id: 3,
      title: 'Dokumen Belum Lengkap',
      subtitle: 'Harap lengkapi KTP dan Selfie',
      date: new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      color: 'bg-amber-100'
    });
  }

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 animate-slide-up px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-[24px] p-8 max-w-md w-full shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-display font-bold text-center text-brand-navy mb-2">Hapus Penghuni?</h3>
            <p className="text-gray-500 text-center text-sm mb-8">
              Anda yakin ingin menghapus data <b>{tenant.name}</b> secara permanen? Jika dihapus, kamar {tenant.room?.room_number} akan otomatis berstatus Kosong kembali.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 border-[1.5px] border-gray-200 text-brand-navy font-bold rounded-xl hover:bg-gray-50 transition-colors"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <button onClick={() => router.push('/tenants')} className="text-gray-400 hover:text-brand-navy transition-colors flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Data Penghuni
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-brand-navy font-bold">Profil Penghuni</span>
      </div>

      {/* Edit Banner */}
      {isEditing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm">
          <Edit2 className="w-4 h-4" /> Mode Edit Aktif — Jangan lupa simpan perubahan Anda.
        </div>
      )}

      {/* Hero Card */}
      <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 bg-brand-teal text-white rounded-full flex items-center justify-center text-3xl font-display font-bold shadow-md">
              {tenant.selfie_url ? (
                <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover rounded-full" />
              ) : initials}
            </div>
            <div className={`absolute bottom-0 right-0 w-5 h-5 border-4 border-white rounded-full ${isContractActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg ${contractStatusColor}`}>
                {contractStatus}
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-brand-navy leading-none mb-2">{tenant.name}</h1>
            <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
              <div className="flex items-center gap-1.5"><DoorOpen className="w-4 h-4" /> Kamar {tenant.room?.room_number || '-'}</div>
              <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {tenant.phone}</div>
              <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Masuk {entryDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {isEditing ? (
             <div className="flex gap-2 w-full">
               <button onClick={() => {setIsEditing(false); setFiles({ktp:null, selfie:null}); fetchData();}} className="flex-1 md:flex-none px-6 py-2.5 border-[1.5px] border-gray-200 text-brand-navy font-bold rounded-xl hover:bg-gray-50 transition-colors">
                 Batal
               </button>
               <button onClick={handleSubmit} disabled={isSaving} className="flex-1 md:flex-none px-6 py-2.5 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
                 {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
               </button>
             </div>
          ) : (
             <div className="flex gap-2 w-full">
               <button onClick={() => setShowDeleteModal(true)} className="flex-1 md:flex-none px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                 <Trash2 className="w-4 h-4" /> <span className="hidden md:inline">Hapus</span>
               </button>
               <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none px-6 py-2.5 bg-brand-teal/10 hover:bg-brand-teal/20 text-brand-teal font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                 <Edit2 className="w-4 h-4" /> Edit Profil
               </button>
             </div>
          )}
        </div>
      </div>

      {/* 3 Stat Pills */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-green-50 text-green-500 rounded-xl flex items-center justify-center"><CreditCard className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Total Pembayaran</p>
            <p className="text-lg font-display font-bold text-brand-navy">Rp {(totalPembayaran/1000000).toFixed(1)}jt</p>
            <p className="text-xs text-gray-500">Lunas Semua</p>
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Status Bayar</p>
            <p className="text-lg font-display font-bold text-brand-navy">Tepat Waktu</p>
            <p className="text-xs text-gray-500">{tenant.rental_duration} bulan terakhir</p>
          </div>
        </div>
        <div className="bg-white border-[1.5px] border-gray-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center"><Calendar className="w-6 h-6" /></div>
          <div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Kontrak Berakhir</p>
            <p className="text-lg font-display font-bold text-brand-navy">{endDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            <p className="text-xs text-gray-500">{isContractActive ? 'Aktif' : 'Telah Berakhir'}</p>
          </div>
        </div>
      </div>

      {/* Grid 2 Kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* KIRI */}
        <div className="space-y-6">
          {/* Card Data Diri */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy mb-1">Data Diri</h3>
            <p className="text-xs text-gray-500 mb-6">Informasi pribadi penghuni</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 uppercase tracking-wide"><User className="w-3.5 h-3.5" /> Nama Lengkap</label>
                {isEditing ? (
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-[1.5px] border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all outline-none" />
                ) : (
                  <div className="bg-gray-50 border-[1.5px] border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy">{tenant.name}</div>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-brand-navy/60 uppercase tracking-wide"><Phone className="w-3.5 h-3.5" /> Nomor HP / WA</label>
                {isEditing ? (
                  <input type="text" value={formData.phone} onChange={handlePhoneChange} className="w-full border-[1.5px] border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all outline-none" />
                ) : (
                  <div className="bg-gray-50 border-[1.5px] border-gray-100 rounded-xl px-4 py-2.5 text-sm font-bold text-brand-navy">{tenant.phone}</div>
                )}
              </div>
            </div>
          </div>

          {/* Card Dokumen Identitas */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy mb-1">Dokumen Identitas</h3>
            <p className="text-xs text-gray-500 mb-6">KTP dan foto selfie penghuni</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* KTP */}
              <div className={`relative border-[1.5px] rounded-2xl overflow-hidden group ${tenant.ktp_url || files.ktp ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                {isEditing && (
                  <label className="absolute top-2 right-2 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm flex items-center justify-center cursor-pointer text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ktp')} className="hidden" />
                  </label>
                )}
                <div className="h-40 flex items-center justify-center overflow-hidden relative">
                  {files.ktp ? (
                    <img src={URL.createObjectURL(files.ktp)} alt="New KTP" className="w-full h-full object-cover" />
                  ) : tenant.ktp_url ? (
                    <>
                      <img src={`http://localhost:8081${tenant.ktp_url}`} alt="KTP" className="w-full h-full object-cover" />
                      <a href={`http://localhost:8081${tenant.ktp_url}`} target="_blank" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-white text-xs font-bold uppercase tracking-widest gap-2">
                        <ImageIcon className="w-4 h-4" /> Lihat
                      </a>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 gap-2"><ImageIcon className="w-8 h-8" /><span className="text-xs font-medium">Belum ada KTP</span></div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-white">
                  <p className="text-sm font-bold text-brand-navy mb-1">Dokumen KTP</p>
                  {(tenant.ktp_url || files.ktp) ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">✓ Terupload</span> : <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">✗ Tidak ada</span>}
                </div>
              </div>

              {/* Selfie */}
              <div className={`relative border-[1.5px] rounded-2xl overflow-hidden group ${tenant.selfie_url || files.selfie ? 'border-gray-200' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                {isEditing && (
                  <label className="absolute top-2 right-2 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm flex items-center justify-center cursor-pointer text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" />
                  </label>
                )}
                <div className="h-40 flex items-center justify-center overflow-hidden relative">
                  {files.selfie ? (
                    <img src={URL.createObjectURL(files.selfie)} alt="New Selfie" className="w-full h-full object-cover" />
                  ) : tenant.selfie_url ? (
                    <>
                      <img src={`http://localhost:8081${tenant.selfie_url}`} alt="Selfie" className="w-full h-full object-cover" />
                      <a href={`http://localhost:8081${tenant.selfie_url}`} target="_blank" className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 text-white text-xs font-bold uppercase tracking-widest gap-2">
                        <ImageIcon className="w-4 h-4" /> Lihat
                      </a>
                    </>
                  ) : (
                    <div className="flex flex-col items-center text-gray-400 gap-2"><User className="w-8 h-8" /><span className="text-xs font-medium">Belum ada Selfie</span></div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-100 bg-white">
                  <p className="text-sm font-bold text-brand-navy mb-1">Foto Selfie</p>
                  {(tenant.selfie_url || files.selfie) ? <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md">✓ Terupload</span> : <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md">✗ Tidak ada</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KANAN */}
        <div className="space-y-6">
          {/* Card Kamar Saat Ini */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy mb-1">Kamar Saat Ini</h3>
            <p className="text-xs text-gray-500 mb-6">Detail kamar yang dihuni</p>
            
            <div className="bg-brand-teal/5 border border-brand-teal/20 rounded-2xl p-5 mb-6 flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/5 rounded-full -translate-y-10 translate-x-10"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm text-brand-teal"><DoorOpen className="w-6 h-6" /></div>
                <div>
                  {isEditing ? (
                    <select value={formData.room_id} onChange={e => setFormData({...formData, room_id: e.target.value})} className="font-display font-bold text-lg text-brand-navy bg-white border border-gray-300 rounded-lg px-2 py-1 outline-none focus:border-brand-teal mb-1">
                      <option value="">— Pilih Kamar Kosong —</option>
                      {rooms.filter(r => r.status === 'available' || r.id === tenant.room_id).map(r => (
                        <option key={r.id} value={r.id}>Kamar {r.room_number}</option>
                      ))}
                    </select>
                  ) : (
                    <h4 className="font-display font-bold text-lg text-brand-navy">Kamar {tenant.room?.room_number || '-'}</h4>
                  )}
                  <p className="text-[10px] font-medium text-brand-navy/60 line-clamp-1">{tenant.room?.description || 'Data fasilitas tidak ada'}</p>
                </div>
              </div>
              <div className="text-right relative z-10">
                <p className="font-display font-bold text-brand-teal text-lg leading-none">Rp {((tenant.room?.price_per_month || 0) / 1000000).toFixed(1)}jt</p>
                <p className="text-[9px] font-bold text-brand-navy/40 uppercase tracking-widest mt-1">PER BULAN</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-sm font-medium text-gray-500">Tanggal Masuk</span>
                {isEditing ? (
                  <input type="date" value={formData.entry_date} onChange={e => setFormData({...formData, entry_date: e.target.value})} className="text-sm font-bold text-brand-navy border border-gray-300 rounded px-2 py-1 outline-none focus:border-brand-teal" />
                ) : (
                  <span className="text-sm font-bold text-brand-navy">{entryDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-sm font-medium text-gray-500">Durasi Kontrak</span>
                {isEditing ? (
                  <select value={formData.rental_duration} onChange={e => setFormData({...formData, rental_duration: Number(e.target.value)})} className="text-sm font-bold text-brand-navy border border-gray-300 rounded px-2 py-1 outline-none focus:border-brand-teal cursor-pointer">
                    <option value="1">1 Bulan</option>
                    <option value="3">3 Bulan</option>
                    <option value="6">6 Bulan</option>
                    <option value="12">12 Bulan</option>
                  </select>
                ) : (
                  <span className="text-sm font-bold text-brand-navy">{tenant.rental_duration} Bulan</span>
                )}
              </div>
              <div className="flex justify-between items-center py-2 border-b border-dashed border-gray-200">
                <span className="text-sm font-medium text-gray-500">Kontrak Berakhir</span>
                <span className="text-sm font-bold text-brand-navy">{endDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm font-medium text-gray-500">Status Kontrak</span>
                <span className={`text-sm font-bold ${isContractActive ? 'text-green-500' : 'text-red-500'}`}>• {contractStatus}</span>
              </div>
            </div>
          </div>

          {/* Card Riwayat Aktivitas */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] p-6 shadow-sm">
            <h3 className="text-sm font-bold text-brand-navy mb-1">Riwayat Aktivitas</h3>
            <p className="text-xs text-gray-500 mb-6">{activities.length} aktivitas terbaru</p>
            
            <div className="space-y-6">
              {activities.map((act, index) => (
                <div key={act.id} className="flex gap-4 relative">
                  {index !== activities.length - 1 && <div className="absolute left-4 top-10 bottom-[-24px] w-[1.5px] bg-gray-100"></div>}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${act.color}`}>
                    {act.icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex justify-between items-start mb-0.5">
                      <p className="text-sm font-bold text-brand-navy">{act.title}</p>
                      <span className="text-[10px] font-bold text-gray-400">{act.date}</span>
                    </div>
                    <p className="text-xs text-gray-500">{act.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
