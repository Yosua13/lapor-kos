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
  UploadCloud,
  ChevronRight,
  ArrowRightLeft,
  LogOut,
  Home,
  FileText,
  Wallet,
  Folder,
  Activity,
  Mail,
  Check,
  Eye,
  ArrowRight,
  File,
  Building2,
  Info,
  Shield,
  ShieldCheck,
  Download,
  Plus,
  ExternalLink,
  ChevronLeft,
  PhoneCall
} from 'lucide-react';
import { apiFetch, API_URL, getImageUrl } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone: string;
  room_id: string;
  ktp_url: string;
  selfie_url: string;

  contract?: {
    start_date: string;
    end_date: string;
    rental_duration: number;
    status: string;
    latest_payment_status?: string | null;
    latest_payment_amount?: number | null;
  };
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
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<'ringkasan' | 'kontrak' | 'data-pribadi' | 'dokumen' | 'pembayaran' | 'aktivitas'>('ringkasan');

  const fetchData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [tenantData, roomsData, paymentsData] = await Promise.all([
        apiFetch(`/api/tenants/${id}`),
        apiFetch('/api/rooms'),
        apiFetch(`/api/payments?user_id=${id}`)
      ]);
      setTenant(tenantData);
      setRooms(roomsData || []);
      setPayments(paymentsData || []);
      setFormData({
        name: tenantData.name,
        phone: tenantData.phone,
        room_id: tenantData.room_id || '',
        entry_date: tenantData.contract?.start_date ? tenantData.contract.start_date.split('T')[0] : '',
        rental_duration: tenantData.contract?.rental_duration || 1
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
      const response = await fetch(`${API_URL}/api/tenants/${id}`, {
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
      const response = await fetch(`${API_URL}/api/tenants/${id}`, {
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
  const entryDateObj = new Date(tenant.contract?.start_date || tenant.created_at);
  const endDateObj = new Date(tenant.contract?.end_date || tenant.created_at);
  const isContractActive = endDateObj >= new Date();
  const contractStatus = isContractActive ? 'Aktif' : 'Kontrak Habis';
  const contractStatusColor = isContractActive ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50';
  const totalPembayaranReal = payments.reduce((acc, p) => acc + (p.total_paid || 0), 0);
  const initials = tenant.name.substring(0, 2).toUpperCase();

  const latestPayment = payments[0] || null;
  const paymentStatusLabel = latestPayment ? (
    latestPayment.status === 'paid' ? 'Lunas' :
      latestPayment.status === 'pending' ? 'Menunggu Verifikasi' :
        latestPayment.status === 'partial' ? 'Bayar Sebagian' :
          latestPayment.status === 'overdue' ? 'Terlambat' : 'Belum Bayar'
  ) : 'Lunas';
  const paymentStatusDesc = latestPayment ? `Bulan ${latestPayment.period_month} - ${latestPayment.period_year}` : 'Belum ada tagihan';

  // Map real payments to activities
  const activities = payments.map((p) => {
    const totalBill = p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
    const dateStr = new Date(p.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    if (p.status === 'paid') {
      return {
        id: `pay-${p.id}`,
        title: `Tagihan Lunas (Bulan ${p.period_month})`,
        subtitle: `Rp ${p.total_paid.toLocaleString('id-ID')} - ${p.payment_method ? p.payment_method.toUpperCase() : 'TRANSFER'}`,
        date: dateStr,
        icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
        color: 'bg-green-100'
      };
    } else if (p.status === 'pending') {
      return {
        id: `pay-${p.id}`,
        title: `Verifikasi Tertunda (Bulan ${p.period_month})`,
        subtitle: `Rp ${p.total_paid.toLocaleString('id-ID')} - Menunggu persetujuan owner`,
        date: dateStr,
        icon: <Clock className="w-4 h-4 text-amber-500" />,
        color: 'bg-amber-100'
      };
    } else if (p.status === 'partial') {
      return {
        id: `pay-${p.id}`,
        title: `Dibayar Sebagian (Bulan ${p.period_month})`,
        subtitle: `Terbayar Rp ${p.total_paid.toLocaleString('id-ID')} dari Rp ${totalBill.toLocaleString('id-ID')}`,
        date: dateStr,
        icon: <AlertTriangle className="w-4 h-4 text-blue-500" />,
        color: 'bg-blue-100'
      };
    } else {
      return {
        id: `pay-${p.id}`,
        title: `Tagihan Belum Dibayar (Bulan ${p.period_month})`,
        subtitle: `Tagihan Rp ${totalBill.toLocaleString('id-ID')} jatuh tempo`,
        date: dateStr,
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        color: 'bg-red-100'
      };
    }
  });

  // Always append "Kontrak Dibuat"
  activities.push({
    id: 'contract-created',
    title: 'Kontrak Dibuat',
    subtitle: `Periode ${tenant.contract?.rental_duration || 1} bulan dimulai`,
    date: new Date(tenant.contract?.start_date || tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    icon: <Clock className="w-4 h-4 text-brand-teal" />,
    color: 'bg-brand-teal/10'
  });

  if (!tenant.selfie_url || !tenant.ktp_url) {
    activities.push({
      id: 'doc-warning',
      title: 'Dokumen Belum Lengkap',
      subtitle: 'Harap lengkapi KTP dan Selfie',
      date: new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      color: 'bg-amber-100'
    });
  }

  return (
    <div className="space-y-6 animate-slide-up pb-10 w-full max-w-[1600px] mx-auto -mt-2 lg:-mt-4">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 animate-slide-up px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 font-bold text-sm ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {toast.message}
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] font-medium text-brand-navy mb-2">
        <button onClick={() => router.push('/tenants')} className="text-gray-500 hover:text-brand-navy transition-colors">
          Penghuni & Kontrak
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
        {activeMenu === 'kontrak' || activeMenu === 'data-pribadi' || activeMenu === 'dokumen' || activeMenu === 'pembayaran' || activeMenu === 'aktivitas' ? (
          <>
            <button onClick={() => setActiveMenu('ringkasan')} className="text-gray-500 hover:text-brand-navy transition-colors">
              Detail Penyewa
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-bold">{activeMenu === 'kontrak' ? 'Kontrak & Sewa' : activeMenu === 'data-pribadi' ? 'Data Pribadi' : activeMenu === 'dokumen' ? 'Dokumen' : activeMenu === 'pembayaran' ? 'Pembayaran' : 'Aktivitas'}</span>
          </>
        ) : (
          <span className="font-bold">Detail Penyewa</span>
        )}
      </div>

      {/* Hero Card */}
      <div className="bg-white rounded-[16px] p-6 lg:p-8 shadow-sm flex flex-col xl:flex-row items-center justify-between gap-6 border border-gray-100">
        <div className="flex items-center gap-6 xl:w-2/3 w-full">
          <div className="w-[84px] h-[84px] bg-[#0e8a7a] text-white rounded-full flex items-center justify-center text-[32px] font-display font-bold shrink-0 overflow-hidden shadow-sm">
            {tenant.selfie_url ? (
              <img src={getImageUrl(tenant.selfie_url)} alt={tenant.name} className="w-full h-full object-cover" />
            ) : initials}
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-[26px] font-display font-extrabold text-[#1f2937] leading-none">{tenant.name}</h1>
              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${contractStatusColor}`}>{contractStatus}</span>
            </div>

             {/* 3 Icons Row */}
            <div className="flex items-center gap-6 xl:gap-8 text-[13px] w-full overflow-x-auto no-scrollbar pb-1">
              <div className="flex items-center gap-2.5 shrink-0">
                <Building2 className="w-5 h-5 text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-500 mb-0.5">Kamar</span>
                  <span className="font-bold text-[#1f2937]">Kamar {tenant.room?.room_number || '-'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Phone className="w-5 h-5 text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-500 mb-0.5">Telepon</span>
                  <span className="font-bold text-[#1f2937]">{tenant.phone}</span>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Mail className="w-5 h-5 text-gray-400" />
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-gray-500 mb-0.5">Email</span>
                  <span className="font-bold text-[#1f2937]">{tenant.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 no-scrollbar shrink-0">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <Edit2 className="w-4 h-4" /> Edit Profil
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <ArrowRightLeft className="w-4 h-4" /> Pindah Kamar
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <Calendar className="w-4 h-4" /> Perpanjang Kontrak
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-[13px] font-bold text-red-600 hover:bg-red-50 whitespace-nowrap transition-colors">
            <LogOut className="w-4 h-4" /> Checkout
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left Sidebar Menu (20%) */}
        <div className="w-full lg:w-[220px] shrink-0 bg-white rounded-[16px] shadow-sm p-3 border border-gray-100 h-fit">
          <nav className="flex flex-col space-y-1">
            <button onClick={() => setActiveMenu('ringkasan')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors ${activeMenu === 'ringkasan' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'ringkasan' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <Home className={`w-5 h-5 ${activeMenu === 'ringkasan' ? '' : 'text-gray-400'}`} /> Ringkasan
            </button>
            <button onClick={() => setActiveMenu('data-pribadi')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors w-full text-left ${activeMenu === 'data-pribadi' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'data-pribadi' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <User className={`w-5 h-5 ${activeMenu === 'data-pribadi' ? '' : 'text-gray-400'}`} /> Data Pribadi
            </button>
            <button onClick={() => setActiveMenu('kontrak')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors w-full text-left ${activeMenu === 'kontrak' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'kontrak' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <FileText className={`w-5 h-5 ${activeMenu === 'kontrak' ? '' : 'text-gray-400'}`} /> Kontrak & Sewa
            </button>
            <button onClick={() => setActiveMenu('pembayaran')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors w-full text-left ${activeMenu === 'pembayaran' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'pembayaran' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <Wallet className={`w-5 h-5 ${activeMenu === 'pembayaran' ? '' : 'text-gray-400'}`} /> Pembayaran
            </button>
            <button onClick={() => setActiveMenu('dokumen')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors w-full text-left ${activeMenu === 'dokumen' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'dokumen' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <Folder className={`w-5 h-5 ${activeMenu === 'dokumen' ? '' : 'text-gray-400'}`} /> Dokumen
            </button>
            <button onClick={() => setActiveMenu('aktivitas')} className={`flex items-center gap-3 px-4 py-3 font-bold text-[14px] rounded-lg relative overflow-hidden group transition-colors w-full text-left ${activeMenu === 'aktivitas' ? 'bg-[#0e8a7a]/5 text-[#0e8a7a]' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              {activeMenu === 'aktivitas' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#0e8a7a] rounded-r-full"></div>}
              <Activity className={`w-5 h-5 ${activeMenu === 'aktivitas' ? '' : 'text-gray-400'}`} /> Aktivitas
            </button>
          </nav>
        </div>

        {/* Right Content Grid (80%) */}
        <div className="flex-1 space-y-6 min-w-0">

          {/* Ringkasan View */}
          {activeMenu === 'ringkasan' && (
            <div className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Ringkasan</h2>
                <p className="text-[13px] text-gray-500">Ringkasan informasi utama mengenai penyewa, kamar, dan status kontrak.</p>
              </div>

              {/* Row 1: 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                {/* Card 1: Kamar Saat Ini */}
                <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <h3 className="font-bold text-[14px]">Kamar Saat Ini</h3>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <h2 className="font-display font-extrabold text-[18px] text-[#1f2937]">Kamar {tenant.room?.room_number || '-'}</h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Aktif</span>
                  </div>
                  <p className="text-[12px] text-gray-500 mb-4 pb-4 border-b border-gray-100">Lantai 4 • Tipe Standard</p>
                  <p className="text-[12px] font-bold text-gray-700 mb-3">Fasilitas Kamar</p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] font-medium text-gray-600 mt-auto">
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Kasur</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> K. Mandi Dalam</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Lemari</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> AC</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Meja Belajar</div>
                    <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Wi-Fi</div>
                  </div>
                </div>

                {/* Card 2: Kontrak Aktif */}
                <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-[14px]">Kontrak Aktif</h3>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-[11px] font-medium text-emerald-700 flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div> <span className="truncate">Kontrak berjalan dengan baik</span>
                  </div>
                  <div className="space-y-2 text-[12px] mb-4">
                    <div className="flex justify-between"><span className="text-gray-500">Mulai</span><span className="font-bold text-[#1f2937]">{new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Berakhir</span><span className="font-bold text-[#1f2937]">3 Sep 2026</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Durasi</span><span className="font-bold text-[#1f2937]">3 Bulan</span></div>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-gray-600 font-medium">Progres Kontrak</span>
                      <span className="font-bold text-[#1f2937]">92%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                    <div className="flex items-baseline gap-1 text-[11px]">
                      <span className="font-bold text-[#1f2937]">85 hari tersisa</span>
                      <span className="text-gray-400">dari total 92 hari</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Status Pembayaran */}
                <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                    <Wallet className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-[14px]">Status Pembayaran</h3>
                  </div>

                  <div className="mb-4">
                    <p className="text-[11px] text-gray-500 mb-1">Total Pembayaran</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[18px] font-display font-extrabold text-[#0e8a7a]">Rp 3.150.000</p>
                      <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Lunas</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 mb-4 mt-auto">
                    <p className="text-[11px] text-gray-500 mb-1">Tagihan Bulan Ini</p>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[14px] font-display font-extrabold text-[#1f2937]">Rp 3.500.000</p>
                      <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Lunas</span>
                    </div>
                    <p className="text-[10px] text-gray-400">Bayar Sebelum <span className="font-bold text-gray-600">3 Jul 2026</span></p>
                  </div>

                  <button className="w-full py-2 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    Lihat Riwayat Pembayaran <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Card 4: Dokumen Identitas */}
                <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                  <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                    <Folder className="w-4 h-4 text-amber-500" />
                    <h3 className="font-bold text-[14px]">Dokumen Identitas</h3>
                  </div>

                  <div className="space-y-3 mb-4 mt-auto">
                    {/* KTP */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 bg-blue-50 rounded bg-cover bg-center border border-gray-200 shrink-0 relative overflow-hidden">
                        <img src={tenant.ktp_url ? getImageUrl(tenant.ktp_url) : "https://via.placeholder.com/150"} alt="KTP" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => tenant.ktp_url && setSelectedImage(getImageUrl(tenant.ktp_url))} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#1f2937] truncate">KTP</p>
                        <p className="text-[10px] text-gray-500 truncate">Diunggah {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <span className="text-[9px] font-bold text-emerald-600">Terverifikasi</span>
                      </div>
                      <button onClick={() => tenant.ktp_url && setSelectedImage(getImageUrl(tenant.ktp_url))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:text-brand-navy hover:bg-gray-50 shrink-0 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Selfie */}
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-10 bg-blue-50 rounded bg-cover bg-center border border-gray-200 shrink-0 relative overflow-hidden">
                        <img src={tenant.selfie_url ? getImageUrl(tenant.selfie_url) : "https://via.placeholder.com/150"} alt="Selfie" className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => tenant.selfie_url && setSelectedImage(getImageUrl(tenant.selfie_url))} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#1f2937] truncate">Selfie dengan KTP</p>
                        <p className="text-[10px] text-gray-500 truncate">Diunggah {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <span className="text-[9px] font-bold text-emerald-600">Terverifikasi</span>
                      </div>
                      <button onClick={() => tenant.selfie_url && setSelectedImage(getImageUrl(tenant.selfie_url))} className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-md text-gray-400 hover:text-brand-navy hover:bg-gray-50 shrink-0 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button className="w-full py-2 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    Lihat Semua Dokumen <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: 3 Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* Card: Detail Kontrak & Sewa */}
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-[14px] text-[#1f2937] mb-4">Detail Kontrak & Sewa</h3>

                  <div className="space-y-3 text-[12px] mb-6 mt-auto">
                    <div className="grid grid-cols-2"><span className="text-gray-500">Nomor Kontrak</span><span className="font-bold text-[#1f2937] text-right">KTR-A-999-060126</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Tipe Kontrak</span><span className="font-bold text-[#1f2937] text-right">Bulanan</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Tanggal Mulai</span><span className="font-bold text-[#1f2937] text-right">3 Jun 2026</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Tanggal Berakhir</span><span className="font-bold text-[#1f2937] text-right">3 Sep 2026</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Durasi</span><span className="font-bold text-[#1f2937] text-right">3 Bulan</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Sewa Bulanan</span><span className="font-bold text-[#1f2937] text-right">Rp 1.500.000</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Deposit</span><span className="font-bold text-[#1f2937] text-right">Rp 500.000</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Denda Keterlambatan</span><span className="font-bold text-[#1f2937] text-right">Rp 50.000 / hari</span></div>
                    <div className="grid grid-cols-2"><span className="text-gray-500">Catatan</span><span className="font-bold text-[#1f2937] text-right">-</span></div>
                  </div>

                  <button className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    <FileText className="w-4 h-4" /> Lihat Detail Kontrak
                  </button>
                </div>

                {/* Card: Ringkasan Pembayaran */}
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-[14px] text-[#1f2937] mb-4">Ringkasan Pembayaran</h3>

                  <div className="space-y-3 text-[12px] mb-4">
                    <div className="flex justify-between"><span className="text-gray-500">Total Sewa (3 bulan)</span><span className="font-bold text-[#1f2937] text-right">Rp 4.500.000</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Deposit</span><span className="font-bold text-[#1f2937] text-right">Rp 500.000</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Diskon</span><span className="font-bold text-[#1f2937] text-right">-</span></div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-3 text-[12px] mb-6 mt-auto">
                    <div className="flex justify-between"><span className="text-[#1f2937] font-bold">Total Pembayaran</span><span className="font-bold text-[#1f2937] text-right">Rp 5.000.000</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Sudah Dibayar</span><span className="font-bold text-[#0e8a7a] text-right">Rp 3.150.000</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Sisa Pembayaran</span><span className="font-bold text-[#f97316] text-right">Rp 1.850.000</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Metode Pembayaran</span><span className="font-bold text-[#1f2937] text-right">Transfer Bank</span></div>
                  </div>

                  <button className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    <Wallet className="w-4 h-4" /> Lihat Riwayat Pembayaran
                  </button>
                </div>

                {/* Card: Aktivitas Terbaru */}
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-[14px] text-[#1f2937] mb-6">Aktivitas Terbaru</h3>

                  <div className="space-y-0 relative mb-6 mt-auto">
                    {/* Vertical Line */}
                    <div className="absolute left-[15px] top-4 bottom-8 w-[1.5px] bg-gray-100"></div>

                    {/* Item 1 */}
                    <div className="flex gap-4 relative pb-5">
                      <div className="w-[32px] h-[32px] bg-emerald-100 rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-white">
                        <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className="text-[12px] font-bold text-[#1f2937]">Pembayaran bulan Juni 2026</p>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">3 Jun 2026, 10:30</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Pembayaran diterima sebesar Rp 1.500.000</p>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex gap-4 relative pb-5">
                      <div className="w-[32px] h-[32px] bg-blue-100 rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-white">
                        <File className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className="text-[12px] font-bold text-[#1f2937]">Kontrak diperbarui</p>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">3 Jun 2026, 10:28</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Kontrak baru berlaku hingga 3 Sep 2026</p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex gap-4 relative pb-5">
                      <div className="w-[32px] h-[32px] bg-purple-100 rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-white">
                        <UploadCloud className="w-3.5 h-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className="text-[12px] font-bold text-[#1f2937]">Dokumen diunggah</p>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">3 Jun 2026, 10:15</span>
                        </div>
                        <p className="text-[11px] text-gray-500">KTP dan selfie berhasil diunggah</p>
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div className="flex gap-4 relative">
                      <div className="w-[32px] h-[32px] bg-amber-100 rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-white">
                        <User className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <div className="flex justify-between items-start mb-0.5">
                          <p className="text-[12px] font-bold text-[#1f2937]">Penyewa dibuat</p>
                          <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">3 Jun 2026, 10:10</span>
                        </div>
                        <p className="text-[11px] text-gray-500">Akun penyewa berhasil dibuat</p>
                      </div>
                    </div>
                  </div>

                  <button className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    Lihat Semua Aktivitas <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Kontrak & Sewa View */}
          {activeMenu === 'kontrak' && (
            <div className="space-y-6 animate-slide-up">
              {/* Header */}
              <div>
                <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Kontrak & Sewa</h2>
                <p className="text-[13px] text-gray-500">Informasi detail mengenai masa sewa, status kontrak, dan fasilitas kamar.</p>
              </div>

              {/* Baris 1: 3 Kartu */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                 {/* Card 1: Kontrak Aktif */}
                 <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col relative overflow-hidden">
                   <div className="flex justify-between items-start mb-4">
                     <div className="flex items-center gap-2 text-[#1f2937]">
                       <Calendar className="w-4 h-4 text-emerald-500" />
                       <h3 className="font-bold text-[14px]">Kontrak Aktif</h3>
                     </div>
                     <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${contractStatusColor}`}>{contractStatus}</span>
                   </div>
                   
                   <div className="space-y-2 text-[12px] mb-4 flex-1">
                     <div className="flex justify-between"><span className="text-gray-500">Nomor Kontrak</span><span className="font-bold text-[#1f2937]">KTR-{tenant.room?.room_number || 'X'}-060126</span></div>
                     <div className="flex justify-between"><span className="text-gray-500">Mulai</span><span className="font-bold text-[#1f2937]">{new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                     <div className="flex justify-between"><span className="text-gray-500">Berakhir</span><span className="font-bold text-[#1f2937]">3 Sep 2026</span></div>
                     <div className="flex justify-between"><span className="text-gray-500">Durasi</span><span className="font-bold text-[#1f2937]">3 Bulan</span></div>
                   </div>

                   <div className="mt-auto">
                     <div className="flex justify-between text-[11px] mb-1">
                       <span className="text-gray-600 font-medium">Progres Kontrak</span>
                       <span className="font-bold text-[#1f2937]">92%</span>
                     </div>
                     <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
                       <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: '92%' }}></div>
                     </div>
                     <div className="flex items-baseline justify-between text-[11px]">
                       <span className="font-bold text-[#1f2937]">85 hari tersisa</span>
                       <span className="text-gray-400">dari 3 bulan</span>
                     </div>
                   </div>
                 </div>

                 {/* Card 2: Informasi Kamar */}
                 <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                     <Home className="w-4 h-4 text-blue-500" />
                     <h3 className="font-bold text-[14px]">Informasi Kamar</h3>
                   </div>
                   <div className="flex justify-between items-center mb-1">
                     <h2 className="font-display font-extrabold text-[18px] text-[#1f2937]">Kamar {tenant.room?.room_number || '-'}</h2>
                   </div>
                   <p className="text-[12px] text-gray-500 mb-4 pb-4 border-b border-gray-100">Lantai 4 • Tipe Standard</p>
                   <p className="text-[12px] font-bold text-gray-700 mb-3">Fasilitas Kamar</p>
                   <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] font-medium text-gray-600 mt-auto">
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Kasur</div>
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> K. Mandi Dalam</div>
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Lemari</div>
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> AC</div>
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Meja Belajar</div>
                     <div className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> Wi-Fi</div>
                   </div>
                 </div>

                 {/* Card 3: Detail Sewa */}
                 <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-4 text-[#1f2937]">
                     <FileText className="w-4 h-4 text-amber-500" />
                     <h3 className="font-bold text-[14px]">Detail Sewa</h3>
                   </div>
                   
                   <div className="space-y-4 text-[12px] mt-2 mb-4 flex-1">
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Harga Sewa Bulanan</span>
                       <span className="font-bold text-[#1f2937]">Rp 1.500.000</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Deposit</span>
                       <span className="font-bold text-[#1f2937]">Rp 500.000</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Jatuh Tempo</span>
                       <span className="font-bold text-[#1f2937]">Setiap tanggal 3</span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Denda Keterlambatan</span>
                       <span className="font-bold text-[#1f2937]">Rp 50.000 / hari</span>
                     </div>
                   </div>
                 </div>
              </div>

              {/* Baris 2: 2 Kartu */}
              <div className="flex flex-col xl:flex-row gap-6">
                 {/* Riwayat Perpanjangan (60%) */}
                 <div className="xl:w-[60%] bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <Calendar className="w-5 h-5 text-purple-500" />
                     <h3 className="font-bold text-[15px]">Riwayat Perpanjangan</h3>
                   </div>
                   
                   <div className="w-full overflow-x-auto mb-6 flex-1">
                     <table className="w-full text-left text-[12px]">
                       <thead>
                         <tr className="border-b border-gray-100">
                           <th className="pb-3 font-medium text-gray-500">Periode Kontrak</th>
                           <th className="pb-3 font-medium text-gray-500">Durasi</th>
                           <th className="pb-3 font-medium text-gray-500">Harga Sewa Bulanan</th>
                           <th className="pb-3 font-medium text-gray-500">Status</th>
                           <th className="pb-3 font-medium text-gray-500">Diperbarui Pada</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                         <tr>
                           <td className="py-4 text-[#1f2937]">3 Jun 2026 - 3 Sep 2026</td>
                           <td className="py-4 text-[#1f2937]">3 Bulan</td>
                           <td className="py-4 text-[#1f2937]">Rp 1.500.000</td>
                           <td className="py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Aktif</span></td>
                           <td className="py-4 text-[#1f2937]">3 Jun 2026, 10:30</td>
                         </tr>
                         <tr>
                           <td className="py-4 text-[#1f2937]">3 Mar 2026 - 3 Jun 2026</td>
                           <td className="py-4 text-[#1f2937]">3 Bulan</td>
                           <td className="py-4 text-[#1f2937]">Rp 1.500.000</td>
                           <td className="py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Selesai</span></td>
                           <td className="py-4 text-[#1f2937]">3 Mar 2026, 09:15</td>
                         </tr>
                         <tr>
                           <td className="py-4 text-[#1f2937]">3 Des 2025 - 3 Mar 2026</td>
                           <td className="py-4 text-[#1f2937]">3 Bulan</td>
                           <td className="py-4 text-[#1f2937]">Rp 1.500.000</td>
                           <td className="py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Selesai</span></td>
                           <td className="py-4 text-[#1f2937]">3 Des 2025, 09:10</td>
                         </tr>
                       </tbody>
                     </table>
                   </div>

                   <button className="w-full py-3 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-xl text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                     Lihat Riwayat Kontrak Lengkap <ArrowRight className="w-4 h-4" />
                   </button>
                 </div>

                 {/* Aturan Pembayaran (40%) */}
                 <div className="xl:w-[40%] bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <Info className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-[15px]">Aturan Pembayaran</h3>
                   </div>
                   
                   <div className="space-y-5">
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Pembayaran dilakukan setiap bulan di awal periode.</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Jatuh tempo pembayaran adalah setiap tanggal 3.</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Jika pembayaran melewati jatuh tempo, akan dikenakan denda keterlambatan.</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Denda keterlambatan sebesar Rp 50.000 per hari.</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Pembayaran dapat dilakukan melalui transfer bank atau metode yang disepakati.</p>
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          )}

          {/* Data Pribadi View */}
          {activeMenu === 'data-pribadi' && (
            <div className="space-y-6 animate-slide-up">
              {/* Header */}
              <div>
                <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Data Pribadi</h2>
                <p className="text-[13px] text-gray-500">Informasi profil lengkap, kontak darurat, dan catatan mengenai penyewa.</p>
              </div>

              {/* Baris 1: 2 Kartu */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {/* Card 1: Informasi Pribadi */}
                 <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <User className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-[15px]">Informasi Pribadi</h3>
                   </div>
                   
                   <div className="space-y-4 text-[13px] text-gray-500 mb-6 flex-1">
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Nama Lengkap</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.name}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-center">
                       <span>Email</span>
                       <span className="font-medium text-[#1f2937] flex items-center gap-2"><span className="text-gray-400">:</span> {tenant.email || `${tenant.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`} <span className="px-2 py-0.5 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-md ml-2">Read-only (Owner)</span></span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Nomor HP/WA</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.phone}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Tanggal Lahir</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Jenis Kelamin</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Alamat</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Pekerjaan</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                   </div>

                   <button className="w-full py-2.5 border border-[#0e8a7a] text-[#0e8a7a] hover:bg-[#0e8a7a]/5 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                     <Edit2 className="w-4 h-4" /> Edit Data Pribadi
                   </button>
                 </div>

                 {/* Card 2: Kontak Darurat */}
                 <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <PhoneCall className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-[15px]">Kontak Darurat</h3>
                   </div>
                   
                   <div className="space-y-4 text-[13px] text-gray-500 flex-1">
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Nama Kontak</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Hubungan</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Nomor HP/WA</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> -</span>
                     </div>
                   </div>

                   <div className="mt-8 bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                     <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                     <p className="text-[12px] leading-relaxed text-blue-800">Pastikan kontak darurat selalu diperbarui untuk memudahkan komunikasi jika terjadi keadaan darurat.</p>
                   </div>
                 </div>
              </div>

              {/* Baris 2: 2 Kartu */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                 {/* Card 3: Informasi Akun */}
                 <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <Shield className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-[15px]">Informasi Akun</h3>
                   </div>
                   
                   <div className="space-y-4 text-[13px] text-gray-500 flex-1 mb-8">
                     <div className="grid grid-cols-[140px_1fr] items-center">
                       <span>Status Akun</span>
                       <span className="font-medium text-[#1f2937] flex items-center gap-2"><span className="text-gray-400">:</span> <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Aktif</span></span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Role</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> Tenant</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Dibuat Pada</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                     </div>
                   </div>

                   <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3 mt-auto">
                     <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                     <p className="text-[12px] leading-relaxed text-blue-800">Owner tidak dapat mengubah password penghuni. Password hanya dapat diubah oleh penghuni sendiri atau melalui alur reset password yang aman.</p>
                   </div>
                 </div>

                 {/* Card 4: Catatan Owner */}
                 <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                   <div className="flex items-center gap-2 mb-6 text-[#1f2937]">
                     <FileText className="w-5 h-5 text-emerald-500" />
                     <h3 className="font-bold text-[15px]">Catatan Owner</h3>
                   </div>
                   
                   <div className="w-full h-[120px] bg-white border border-gray-200 rounded-xl p-4 mb-6 flex-1">
                     <p className="text-[13px] text-gray-400">Belum ada catatan dari owner.</p>
                   </div>

                   <button className="w-full py-2.5 border border-[#0e8a7a] text-[#0e8a7a] hover:bg-[#0e8a7a]/5 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                     <FileText className="w-4 h-4" /> Lihat Dokumen
                   </button>
                 </div>
              </div>
            </div>
          )}

          {/* Dokumen View */}
          {activeMenu === 'dokumen' && (
            <div className="space-y-6 animate-slide-up">
              <div>
                <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Dokumen</h2>
                <p className="text-[13px] text-gray-500">Kelola dan perbarui dokumen identitas penghuni. Pastikan semua dokumen valid dan terbaru.</p>
              </div>

              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-blue-800"><span className="font-bold">Catatan:</span> Password akun tidak dapat diubah di halaman ini. Perubahan password hanya dapat dilakukan oleh penghuni.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                {/* Left Side: 3 Document Cards (col-span-2) */}
                <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* KTP */}
                  <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-[14px] text-[#1f2937]">KTP</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Terverifikasi</span>
                    </div>
                    <div className="w-full h-[120px] bg-gray-100 rounded-xl mb-4 overflow-hidden relative cursor-pointer group" onClick={() => tenant.ktp_url && setSelectedImage(getImageUrl(tenant.ktp_url))}>
                      <img src={tenant.ktp_url ? getImageUrl(tenant.ktp_url) : "https://via.placeholder.com/300x200?text=KTP"} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="KTP" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">{new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:15</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="w-20">Status</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">Terverifikasi <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                      </div>
                    </div>
                    <div className="mt-auto space-y-2">
                      <button onClick={() => tenant.ktp_url && setSelectedImage(getImageUrl(tenant.ktp_url))} className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> Lihat
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Download className="w-3.5 h-3.5" /> Unduh
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <UploadCloud className="w-3.5 h-3.5" /> Ganti Dokumen
                      </button>
                    </div>
                  </div>

                  {/* Selfie */}
                  <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-[14px] text-[#1f2937]">Selfie dengan KTP</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Terverifikasi</span>
                    </div>
                    <div className="w-full h-[120px] bg-gray-100 rounded-xl mb-4 overflow-hidden relative cursor-pointer group" onClick={() => tenant.selfie_url && setSelectedImage(getImageUrl(tenant.selfie_url))}>
                      <img src={tenant.selfie_url ? getImageUrl(tenant.selfie_url) : "https://via.placeholder.com/300x200?text=Selfie"} className="w-full h-full object-cover object-top transition-transform group-hover:scale-105" alt="Selfie" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">{new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:16</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="w-20">Status</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">Terverifikasi <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                      </div>
                    </div>
                    <div className="mt-auto space-y-2">
                      <button onClick={() => tenant.selfie_url && setSelectedImage(getImageUrl(tenant.selfie_url))} className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> Lihat
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Download className="w-3.5 h-3.5" /> Unduh
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <UploadCloud className="w-3.5 h-3.5" /> Ganti Dokumen
                      </button>
                    </div>
                  </div>

                  {/* Dokumen Tambahan */}
                  <div className="bg-white rounded-[16px] shadow-sm p-5 border border-gray-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-[14px] text-[#1f2937]">Dokumen Tambahan</h3>
                      <span className="px-2 py-0.5 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-md">Opsional</span>
                    </div>
                    <div className="w-full h-[120px] bg-gray-50 border border-gray-200 rounded-xl mb-4 overflow-hidden relative cursor-pointer group flex items-center justify-center">
                      <FileText className="w-10 h-10 text-gray-300" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">{new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:20</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="w-20">Status</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">Terverifikasi <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                      </div>
                    </div>
                    <div className="mt-auto space-y-2">
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Eye className="w-3.5 h-3.5" /> Lihat
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <Download className="w-3.5 h-3.5" /> Unduh
                      </button>
                      <button className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
                        <UploadCloud className="w-3.5 h-3.5" /> Ganti Dokumen
                      </button>
                    </div>
                  </div>

                </div>

                {/* Right Side: Info & Upload */}
                <div className="flex flex-col gap-6">
                  {/* Status Lengkap */}
                  <div className="bg-[#f0fdf4] border border-emerald-100 rounded-[16px] shadow-sm p-6">
                    <div className="flex items-start gap-4 mb-6">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="w-5 h-5 text-white stroke-[3]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[15px] text-emerald-900 mb-1">Dokumen Lengkap</h3>
                        <p className="text-[12px] text-emerald-700 leading-relaxed">Semua dokumen wajib telah diunggah dan terverifikasi.</p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-600">KTP</span>
                        <span className="text-emerald-600 font-bold">Terverifikasi</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-600">Selfie dengan KTP</span>
                        <span className="text-emerald-600 font-bold">Terverifikasi</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-gray-600">Dokumen Tambahan</span>
                        <span className="text-emerald-600 font-bold">Terverifikasi</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-bold text-[13px] text-emerald-900 mb-0.5">Keamanan Data Terjamin</h4>
                  <p className="text-[12px] text-emerald-800">Semua dokumen dienkripsi dan disimpan dengan aman. Hanya Anda yang dapat mengakses dokumen penghuni Anda.</p>
                </div>
              </div>
            </div>
          )}

          {/* Pembayaran View */}
          {activeMenu === 'pembayaran' && (
            <div className="space-y-6 animate-slide-up">
              {/* Header */}
              <div>
                <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Pembayaran</h2>
                <p className="text-[13px] text-gray-500">Pantau status pembayaran, tagihan berjalan, dan riwayat transaksi penyewa.</p>
              </div>

              {/* Top 4 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Total Tagihan</h3>
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp 3.150.000</p>
                    <p className="text-[11px] text-gray-400">Total seluruh tagihan</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Sudah Dibayar</h3>
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp 3.150.000</p>
                    <p className="text-[11px] text-gray-400">Total pembayaran masuk</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Sisa Pembayaran</h3>
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp 0</p>
                    <p className="text-[11px] text-gray-400">Masih harus dibayar</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-emerald-500 stroke-[3]" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Status Pembayaran</h3>
                    <div className="mb-1"><span className="px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Lunas</span></div>
                    <p className="text-[11px] text-gray-400 mt-1">Tidak ada tunggakan</p>
                  </div>
                </div>
              </div>

              {/* Tagihan Berjalan */}
              <div className="bg-white rounded-[16px] shadow-sm p-6 border border-emerald-500 flex flex-col xl:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full xl:w-auto">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[13px] text-emerald-600 mb-1">Tagihan Berjalan</h3>
                    <p className="font-bold text-[16px] text-[#1f2937] mb-1">Pembayaran Sewa Agustus 2026</p>
                    <p className="text-[12px] text-gray-500">Periode 1 Agu 2026 - 31 Agu 2026</p>
                  </div>
                </div>

                <div className="flex w-full xl:w-auto gap-8 justify-between xl:justify-end">
                  <div className="w-px bg-gray-200 hidden md:block"></div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">Jatuh Tempo</p>
                    <p className="font-bold text-[14px] text-[#1f2937] mb-1">3 Agu 2026</p>
                    <p className="text-[11px] font-bold text-red-500">H-5 hari</p>
                  </div>
                  <div className="w-px bg-gray-200 hidden md:block"></div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">Nominal Tagihan</p>
                    <p className="font-bold text-[14px] text-[#1f2937] mb-1">Rp 150.000</p>
                  </div>
                  <div className="w-px bg-gray-200 hidden md:block"></div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">Status</p>
                    <div className="mt-1"><span className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-100 rounded-md">Menunggu</span></div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" /> Buat Tagihan
                  </button>
                  <button className="flex-1 sm:flex-none px-4 py-2.5 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Tandai Lunas
                  </button>
                </div>
                <button className="w-full sm:w-auto px-4 py-2.5 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2">
                  <ExternalLink className="w-4 h-4" /> Lihat Riwayat Pembayaran
                </button>
              </div>

              {/* Riwayat Pembayaran Table */}
              <div className="bg-white rounded-[16px] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <h3 className="font-bold text-[15px] text-[#1f2937]">Riwayat Pembayaran</h3>
                </div>
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-left text-[13px]">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="px-5 py-4 font-bold text-gray-600">Tanggal</th>
                        <th className="px-5 py-4 font-bold text-gray-600">Deskripsi</th>
                        <th className="px-5 py-4 font-bold text-gray-600">Metode</th>
                        <th className="px-5 py-4 font-bold text-gray-600">Jumlah</th>
                        <th className="px-5 py-4 font-bold text-gray-600">Status</th>
                        <th className="px-5 py-4 font-bold text-gray-600">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-gray-600 font-medium">3 Jun 2026</td>
                        <td className="px-5 py-4 text-[#1f2937]">Pembayaran Sewa Juni 2026</td>
                        <td className="px-5 py-4 text-gray-600">Transfer Bank</td>
                        <td className="px-5 py-4 text-[#1f2937] font-medium">Rp 1.500.000</td>
                        <td className="px-5 py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Lunas</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Eye className="w-4 h-4" /></button>
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Download className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-gray-600 font-medium">3 Jul 2026</td>
                        <td className="px-5 py-4 text-[#1f2937]">Pembayaran Sewa Juli 2026</td>
                        <td className="px-5 py-4 text-gray-600">Transfer Bank</td>
                        <td className="px-5 py-4 text-[#1f2937] font-medium">Rp 1.500.000</td>
                        <td className="px-5 py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Lunas</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Eye className="w-4 h-4" /></button>
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Download className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-4 text-gray-600 font-medium">3 Agu 2026</td>
                        <td className="px-5 py-4 text-[#1f2937]">Pembayaran Sewa Agustus 2026</td>
                        <td className="px-5 py-4 text-gray-600">Transfer Bank</td>
                        <td className="px-5 py-4 text-[#1f2937] font-medium">Rp 150.000</td>
                        <td className="px-5 py-4"><span className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-md">DP</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Eye className="w-4 h-4" /></button>
                            <button className="p-1.5 border border-gray-200 hover:bg-gray-50 rounded-md text-gray-500 transition-colors"><Download className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[12px] text-gray-500 font-medium">Menampilkan 3 dari 3 data</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 transition-colors" disabled><ChevronLeft className="w-4 h-4" /></button>
                    <button className="w-7 h-7 bg-[#0e8a7a] text-white rounded-md text-[13px] font-bold flex items-center justify-center">1</button>
                    <button className="p-1.5 border border-gray-200 rounded-md text-gray-400 hover:bg-gray-50 transition-colors" disabled><ChevronRight className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aktivitas View */}
          {activeMenu === 'aktivitas' && (
            <div className="space-y-6 animate-slide-up">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-[20px] text-[#1f2937] mb-1">Aktivitas</h2>
                  <p className="text-[13px] text-gray-500">Riwayat aktivitas dan log semua tindakan untuk penyewa ini.</p>
                </div>
                <button className="px-4 py-2 border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center sm:justify-start gap-2 shrink-0">
                  <Download className="w-4 h-4" /> Export Log
                </button>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                <button className="px-4 py-2 bg-emerald-50 border border-emerald-500 text-emerald-700 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0">
                  <CheckCircle2 className="w-4 h-4" /> Semua
                </button>
                <button className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0">
                  <Calendar className="w-4 h-4" /> Pembayaran
                </button>
                <button className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0">
                  <File className="w-4 h-4" /> Kontrak
                </button>
                <button className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0">
                  <FileText className="w-4 h-4" /> Dokumen
                </button>
                <button className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0">
                  <DoorOpen className="w-4 h-4" /> Check-in
                </button>
                <button className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 shrink-0">
                  <LogOut className="w-4 h-4" /> Checkout
                </button>
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[20px] top-4 bottom-4 w-px bg-gray-200"></div>

                <div className="space-y-4">
                  {/* Item 1: Pembayaran */}
                  <div className="relative flex items-start gap-4 xl:gap-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">Pembayaran bulan Juni 2026 diterima</h3>
                        <p className="text-[12px] text-gray-500">Pembayaran diterima sebesar Rp 1.500.000 melalui Transfer Bank.</p>
                      </div>
                      <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Berhasil</span>
                        <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> 3 Jun 2026, 10:30</div>
                        <div className="flex items-center gap-2 text-[#1f2937] font-medium w-[120px]"><User className="w-4 h-4" /> Sistem</div>
                      </div>
                    </div>
                  </div>

                  {/* Item 2: Kontrak */}
                  <div className="relative flex items-start gap-4 xl:gap-6">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1">
                      <File className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">Kontrak diperpanjang hingga 3 Sep 2026</h3>
                        <p className="text-[12px] text-gray-500">Kontrak baru telah dibuat hingga tanggal 3 Sep 2026.</p>
                      </div>
                      <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Berhasil</span>
                        <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> 3 Jun 2026, 10:28</div>
                        <div className="flex items-center gap-2 text-[#1f2937] font-medium w-[120px]"><User className="w-4 h-4" /> Yosua (Owner)</div>
                      </div>
                    </div>
                  </div>

                  {/* Item 3: Dokumen */}
                  <div className="relative flex items-start gap-4 xl:gap-6">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1">
                      <FileText className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">Dokumen KTP diunggah</h3>
                        <p className="text-[12px] text-gray-500">KTP atas nama {tenant.name} berhasil diunggah.</p>
                      </div>
                      <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Berhasil</span>
                        <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> 3 Jun 2026, 10:15</div>
                        <div className="flex items-center gap-2 text-[#1f2937] font-medium w-[120px]"><User className="w-4 h-4" /> Yosua (Owner)</div>
                      </div>
                    </div>
                  </div>

                  {/* Item 4: Kamar */}
                  <div className="relative flex items-start gap-4 xl:gap-6">
                    <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1">
                      <ArrowRightLeft className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">Penyewa pindah kamar</h3>
                        <p className="text-[12px] text-gray-500">Penyewa dipindahkan dari Kamar A-888 ke Kamar {tenant.room?.room_number || 'A-999'}.</p>
                      </div>
                      <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Berhasil</span>
                        <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> 1 Jun 2026, 14:45</div>
                        <div className="flex items-center gap-2 text-[#1f2937] font-medium w-[120px]"><User className="w-4 h-4" /> Yosua (Owner)</div>
                      </div>
                    </div>
                  </div>

                  {/* Item 5: Akun */}
                  <div className="relative flex items-start gap-4 xl:gap-6">
                    <div className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1">
                      <User className="w-4 h-4 stroke-[3]" />
                    </div>
                    <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">Akun penyewa dibuat</h3>
                        <p className="text-[12px] text-gray-500">Akun penyewa baru berhasil dibuat.</p>
                      </div>
                      <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Berhasil</span>
                        <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> 1 Jun 2026, 14:30</div>
                        <div className="flex items-center gap-2 text-[#1f2937] font-medium w-[120px]"><User className="w-4 h-4" /> Sistem</div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* View All Button */}
              <button className="w-full py-3.5 bg-[#0e8a7a]/5 hover:bg-[#0e8a7a]/10 border border-[#0e8a7a]/20 text-[#0e8a7a] rounded-[12px] text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-2">
                Lihat Semua Aktivitas <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 md:-right-12 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={selectedImage} alt="Document Preview" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}
