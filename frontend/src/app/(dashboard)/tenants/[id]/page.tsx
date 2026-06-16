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
  date_of_birth?: string;
  gender?: string;
  address?: string;
  job?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  notes?: string;
  is_active?: boolean;
  additional_doc_url?: string;

  contract?: {
    id: string;
    start_date: string;
    end_date: string;
    rental_duration: number;
    status: string;
    latest_payment_status?: string | null;
    latest_payment_amount?: number | null;
    monthly_rent: number;
    total_price: number;
    deposit: number;
    payment_due_day: number;
    notes?: string;
  };
  created_at: string;
  room?: {
    id: string;
    room_number: string;
    price_per_month: number;
    description: string;
    status: string;
    type?: string;
    floor?: string;
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
  const [activityFilter, setActivityFilter] = useState<'all' | 'pembayaran' | 'kontrak' | 'check-in' | 'checkout'>('all');

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

  const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isChangingRoom, setIsChangingRoom] = useState(false);

  const [showExtendModal, setShowExtendModal] = useState(false);
  const [extendData, setExtendData] = useState({
    start_date: '',
    rental_duration: '1',
    monthly_rent: '',
    electricity_bill: '',
    water_bill: '',
    other_bills: '',
    payment_due_day: '1',
    notes: ''
  });
  const [isExtending, setIsExtending] = useState(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // New fields for tenant profile editing
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    job: '',
    address: '',
    notes: '',
    emergency_contact_name: '',
    emergency_contact_relation: '',
    emergency_contact_phone: ''
  });
  const [editFiles, setEditFiles] = useState<{ ktp: File | null, selfie: File | null, additional_doc: File | null }>({
    ktp: null,
    selfie: null,
    additional_doc: null
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
      setEditFormData({
        name: tenantData.name || '',
        phone: tenantData.phone || '',
        email: tenantData.email || '',
        date_of_birth: tenantData.date_of_birth ? tenantData.date_of_birth.split('T')[0] : '',
        gender: tenantData.gender || '',
        job: tenantData.job || '',
        address: tenantData.address || '',
        notes: tenantData.notes || '',
        emergency_contact_name: tenantData.emergency_contact_name || '',
        emergency_contact_relation: tenantData.emergency_contact_relation || '',
        emergency_contact_phone: tenantData.emergency_contact_phone || ''
      });
      if (tenantData.contract?.end_date) {
        setExtendData(prev => ({
          ...prev,
          start_date: tenantData.contract.end_date.split('T')[0],
          monthly_rent: String(tenantData.contract.monthly_rent || '')
        }));
      }
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

  const handleEditProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name.trim()) { alert('Nama wajib diisi'); return; }
    if (!editFormData.phone.trim()) { alert('Nomor HP wajib diisi'); return; }

    setIsSaving(true);
    try {
      const data = new FormData();
      data.append('name', editFormData.name);
      data.append('phone', editFormData.phone);
      data.append('room_id', tenant?.room?.id || '');
      data.append('entry_date', tenant?.contract?.start_date ? tenant.contract.start_date.split('T')[0] : '');
      data.append('rental_duration', String(tenant?.contract?.rental_duration || 1));
      
      data.append('date_of_birth', editFormData.date_of_birth);
      data.append('gender', editFormData.gender);
      data.append('job', editFormData.job);
      data.append('address', editFormData.address);
      data.append('notes', editFormData.notes);
      data.append('emergency_contact_name', editFormData.emergency_contact_name);
      data.append('emergency_contact_relation', editFormData.emergency_contact_relation);
      data.append('emergency_contact_phone', editFormData.emergency_contact_phone);

      if (editFiles.ktp) data.append('ktp', editFiles.ktp);
      if (editFiles.selfie) data.append('selfie', editFiles.selfie);
      if (editFiles.additional_doc) data.append('additional_doc', editFiles.additional_doc);

      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch(`${API_URL}/api/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });

      if (!response.ok) throw new Error('Gagal memperbarui profil');

      setIsEditing(false);
      setEditFiles({ ktp: null, selfie: null, additional_doc: null });
      fetchData();
      showToast('Profil berhasil diperbarui!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) { alert('Silahkan pilih kamar baru'); return; }

    setIsChangingRoom(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch(`${API_URL}/api/tenants/${id}/change-room`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ room_id: selectedRoomId })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal memindahkan kamar');
      }

      setShowChangeRoomModal(false);
      fetchData();
      showToast('Berhasil memindahkan kamar!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsChangingRoom(false);
    }
  };

  const handleExtendContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendData.start_date) { alert('Tanggal mulai wajib diisi'); return; }
    if (!extendData.rental_duration) { alert('Durasi wajib diisi'); return; }
    if (!extendData.monthly_rent) { alert('Harga sewa wajib diisi'); return; }

    setIsExtending(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const payload = {
        start_date: extendData.start_date,
        rental_duration: parseInt(extendData.rental_duration, 10),
        monthly_rent: parseFloat(extendData.monthly_rent.replace(/\D/g, '')),
        electricity_bill: parseFloat(extendData.electricity_bill.replace(/\D/g, '')) || 0,
        water_bill: parseFloat(extendData.water_bill.replace(/\D/g, '')) || 0,
        other_bills: parseFloat(extendData.other_bills.replace(/\D/g, '')) || 0,
        payment_due_day: parseInt(extendData.payment_due_day, 10) || 1,
        notes: extendData.notes
      };

      const response = await fetch(`${API_URL}/api/tenants/${id}/extend-contract`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal memperpanjang kontrak');
      }

      setShowExtendModal(false);
      fetchData();
      showToast('Kontrak berhasil diperpanjang dan tagihan baru dibuat!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsExtending(false);
    }
  };

  const handleCheckoutSubmit = async () => {
    setIsCheckingOut(true);
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch(`${API_URL}/api/tenants/${id}/checkout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal melakukan checkout');
      }

      setShowCheckoutModal(false);
      fetchData();
      showToast('Penghuni berhasil checkout!');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (!mounted || isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-12 h-12 animate-spin text-brand-teal mb-4" />
      <p className="text-brand-navy/40 font-bold text-xs uppercase tracking-widest">Memuat Profil...</p>
    </div>
  );

  if (!tenant) return null;

  const formatContractNumber = (id?: string) => {
    if (!id) return '-';
    return `KTR-${id.substring(0, 8).toUpperCase()}`;
  };

  // Calculations
  const entryDateObj = new Date(tenant.contract?.start_date || tenant.created_at);
  const endDateObj = new Date(tenant.contract?.end_date || tenant.created_at);
  const isContractActive = tenant.contract ? (endDateObj >= new Date() && tenant.contract.status === 'active') : false;
  const contractStatus = tenant.contract ? (isContractActive ? 'Aktif' : 'Kontrak Habis') : 'Tidak Ada Kontrak';
  const contractStatusColor = tenant.contract ? (isContractActive ? 'text-green-500 bg-green-50' : 'text-red-500 bg-red-50') : 'text-gray-500 bg-gray-50';
  
  const start = tenant.contract?.start_date ? new Date(tenant.contract.start_date).getTime() : 0;
  const end = tenant.contract?.end_date ? new Date(tenant.contract.end_date).getTime() : 0;
  const now = new Date().getTime();

  let progressPercent = 0;
  let daysRemaining = 0;
  let totalDays = 0;
  if (start && end) {
    const totalDuration = end - start;
    const elapsed = now - start;
    progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
    daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
    totalDays = Math.ceil(totalDuration / (1000 * 60 * 60 * 24));
  }

  const totalPembayaranReal = payments.reduce((acc, p) => acc + (p.total_paid || 0), 0);
  const totalBilled = payments.reduce((acc, p) => acc + (p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other), 0);
  const totalPaidSum = totalPembayaranReal;
  const totalOutstanding = Math.max(0, totalBilled - totalPaidSum);
  const hasUnpaid = payments.some(p => p.status !== 'paid');
  const activeBill = payments.find(p => p.status !== 'paid') || payments[0] || null;

  const paymentStatusColorCard = (!hasUnpaid && payments.length > 0) ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50';
  const paymentStatusLabelCard = (!hasUnpaid && payments.length > 0) ? 'Lunas' : 'Belum Lunas';

  const activeBillStatusLabel = activeBill ? (
    activeBill.status === 'paid' ? 'Lunas' :
    activeBill.status === 'pending' ? 'Menunggu' :
    activeBill.status === 'partial' ? 'Sebagian' : 'Belum Bayar'
  ) : '-';
  const activeBillStatusColor = activeBill ? (
    activeBill.status === 'paid' ? 'text-emerald-600 bg-emerald-50' :
    activeBill.status === 'pending' ? 'text-amber-700 bg-amber-100' :
    activeBill.status === 'partial' ? 'text-blue-700 bg-blue-100' : 'text-red-700 bg-red-100'
  ) : '';

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
        color: 'bg-green-100',
        type: 'pembayaran'
      };
    } else if (p.status === 'pending') {
      return {
        id: `pay-${p.id}`,
        title: `Verifikasi Tertunda (Bulan ${p.period_month})`,
        subtitle: `Rp ${p.total_paid.toLocaleString('id-ID')} - Menunggu persetujuan owner`,
        date: dateStr,
        icon: <Clock className="w-4 h-4 text-amber-500" />,
        color: 'bg-amber-100',
        type: 'pembayaran'
      };
    } else if (p.status === 'partial') {
      return {
        id: `pay-${p.id}`,
        title: `Dibayar Sebagian (Bulan ${p.period_month})`,
        subtitle: `Terbayar Rp ${p.total_paid.toLocaleString('id-ID')} dari Rp ${totalBill.toLocaleString('id-ID')}`,
        date: dateStr,
        icon: <AlertTriangle className="w-4 h-4 text-blue-500" />,
        color: 'bg-blue-100',
        type: 'pembayaran'
      };
    } else {
      return {
        id: `pay-${p.id}`,
        title: `Tagihan Belum Dibayar (Bulan ${p.period_month})`,
        subtitle: `Tagihan Rp ${totalBill.toLocaleString('id-ID')} jatuh tempo`,
        date: dateStr,
        icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        color: 'bg-red-100',
        type: 'pembayaran'
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
    color: 'bg-brand-teal/10',
    type: 'kontrak'
  });

  // Dynamic Check-in Activity
  if (tenant.contract?.start_date) {
    activities.push({
      id: 'check-in',
      title: 'Check-in Kamar',
      subtitle: `Penghuni masuk ke Kamar ${tenant.room?.room_number || '-'}`,
      date: new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <DoorOpen className="w-4 h-4 text-emerald-500" />,
      color: 'bg-emerald-100',
      type: 'check-in'
    });
  }

  // Dynamic Checkout Activity (if contract is inactive or checked out)
  if (tenant.contract?.status === 'checked_out' || tenant.contract?.status === 'inactive') {
    activities.push({
      id: 'checkout',
      title: 'Checkout Kamar',
      subtitle: `Penghuni telah keluar dari Kamar ${tenant.room?.room_number || '-'}`,
      date: new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <LogOut className="w-4 h-4 text-red-500" />,
      color: 'bg-red-100',
      type: 'checkout'
    });
  }

  if (!tenant.selfie_url || !tenant.ktp_url) {
    activities.push({
      id: 'doc-warning',
      title: 'Dokumen Belum Lengkap',
      subtitle: 'Harap lengkapi KTP dan Selfie',
      date: new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      color: 'bg-amber-100',
      type: 'dokumen'
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
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <Edit2 className="w-4 h-4" /> Edit Profil
          </button>
          <button onClick={() => setShowChangeRoomModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors">
            <ArrowRightLeft className="w-4 h-4" /> Pindah Kamar
          </button>
          <button 
            onClick={() => {
              if (daysRemaining > 7) {
                showToast(`Kontrak belum bisa diperpanjang (tersisa ${daysRemaining} hari). Hanya bisa diperpanjang H-7 hari.`, 'error');
              } else {
                setShowExtendModal(true);
              }
            }} 
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-[13px] font-bold text-gray-700 hover:bg-gray-50 whitespace-nowrap transition-colors"
          >
            <Calendar className="w-4 h-4" /> Perpanjang Kontrak
          </button>
          <button onClick={() => setShowCheckoutModal(true)} className="flex items-center gap-2 px-4 py-2 border border-red-200 rounded-lg text-[13px] font-bold text-red-600 hover:bg-red-50 whitespace-nowrap transition-colors">
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
                  <p className="text-[12px] text-gray-500 mb-4 pb-4 border-b border-gray-100">
                    Lantai {tenant.room?.floor || '-'} • Tipe {tenant.room?.type || '-'}
                  </p>
                  <p className="text-[12px] font-bold text-gray-700 mb-3">Fasilitas Kamar</p>
                  {tenant.room?.description ? (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] font-medium text-gray-600">
                      {tenant.room.description.split(',').map((f, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> {f.trim()}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">Tidak ada fasilitas terdaftar.</p>
                  )}
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
                    <div className="flex justify-between">
                      <span className="text-gray-500">Mulai</span>
                      <span className="font-bold text-[#1f2937]">
                        {tenant.contract?.start_date ? new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Berakhir</span>
                      <span className="font-bold text-[#1f2937]">
                        {tenant.contract?.end_date ? new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Durasi</span>
                      <span className="font-bold text-[#1f2937]">
                        {tenant.contract?.rental_duration ? `${tenant.contract.rental_duration} Bulan` : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-auto">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-gray-600 font-medium">Progres Kontrak</span>
                      <span className="font-bold text-[#1f2937]">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="flex items-baseline gap-1 text-[11px]">
                      <span className="font-bold text-[#1f2937]">{daysRemaining} hari tersisa</span>
                      <span className="text-gray-400">dari total {totalDays} hari</span>
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
                       <p className="text-[18px] font-display font-extrabold text-[#0e8a7a]">
                         Rp {totalPaidSum.toLocaleString('id-ID')}
                       </p>
                       <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${paymentStatusColorCard}`}>
                         {paymentStatusLabelCard}
                       </span>
                     </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 mb-4 mt-auto">
                    <p className="text-[11px] text-gray-500 mb-1">Tagihan Bulan Ini</p>
                    {activeBill ? (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[14px] font-display font-extrabold text-[#1f2937]">
                            Rp {(activeBill.amount_rent + activeBill.amount_electricity + activeBill.amount_water + activeBill.amount_other).toLocaleString('id-ID')}
                          </p>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${activeBillStatusColor}`}>
                            {activeBillStatusLabel}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400">
                          Bayar Sebelum <span className="font-bold text-gray-600">{new Date(activeBill.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-[12px] text-gray-400">Tidak ada tagihan aktif</p>
                    )}
                  </div>

                  <button onClick={() => setActiveMenu('pembayaran')} className="w-full py-2 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
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
                        {tenant.ktp_url ? (
                          <>
                            <p className="text-[10px] text-gray-500 truncate">Diunggah {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            <span className="text-[9px] font-bold text-emerald-600">Terverifikasi</span>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-gray-400 truncate">Belum diunggah</p>
                            <span className="text-[9px] font-bold text-gray-400">Belum Ada</span>
                          </>
                        )}
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
                        {tenant.selfie_url ? (
                          <>
                            <p className="text-[10px] text-gray-500 truncate">Diunggah {new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            <span className="text-[9px] font-bold text-emerald-600">Terverifikasi</span>
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] text-gray-400 truncate">Belum diunggah</p>
                            <span className="text-[9px] font-bold text-gray-400">Belum Ada</span>
                          </>
                        )}
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
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Nomor Kontrak</span>
                      <span className="font-bold text-[#1f2937] text-right truncate pl-2">{formatContractNumber(tenant.contract?.id)}</span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Tipe Kontrak</span>
                      <span className="font-bold text-[#1f2937] text-right">{tenant.contract ? 'Bulanan' : '-'}</span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Tanggal Mulai</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.start_date ? new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Tanggal Berakhir</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.end_date ? new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Durasi</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.rental_duration ? `${tenant.contract.rental_duration} Bulan` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Sewa Bulanan</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.monthly_rent ? `Rp ${tenant.contract.monthly_rent.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Deposit</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.deposit ? `Rp ${tenant.contract.deposit.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2">
                      <span className="text-gray-500">Catatan</span>
                      <span className="font-bold text-[#1f2937] text-right truncate pl-2">{tenant.contract?.notes || '-'}</span>
                    </div>
                  </div>

                  <button onClick={() => setActiveMenu('kontrak')} className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    <FileText className="w-4 h-4" /> Lihat Detail Kontrak
                  </button>
                </div>

                {/* Card: Ringkasan Pembayaran */}
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-[14px] text-[#1f2937] mb-4">Ringkasan Pembayaran</h3>

                  <div className="space-y-3 text-[12px] mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Sewa</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.total_price ? `Rp ${tenant.contract.total_price.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deposit</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract?.deposit ? `Rp ${tenant.contract.deposit.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Diskon</span>
                      <span className="font-bold text-[#1f2937] text-right">-</span>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-3 text-[12px] mb-6 mt-auto">
                    <div className="flex justify-between">
                      <span className="text-[#1f2937] font-bold">Total Pembayaran</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {tenant.contract ? `Rp ${(tenant.contract.total_price + tenant.contract.deposit).toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sudah Dibayar</span>
                      <span className="font-bold text-[#0e8a7a] text-right">
                        Rp {totalPembayaranReal.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sisa Pembayaran</span>
                      <span className="font-bold text-[#f97316] text-right">
                        Rp {Math.max(0, (tenant.contract ? (tenant.contract.total_price + tenant.contract.deposit) : 0) - totalPembayaranReal).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Metode Pembayaran</span>
                      <span className="font-bold text-[#1f2937] text-right">
                        {payments[0]?.payment_method || '-'}
                      </span>
                    </div>
                  </div>

                  <button onClick={() => setActiveMenu('pembayaran')} className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
                    <Wallet className="w-4 h-4" /> Lihat Riwayat Pembayaran
                  </button>
                </div>

                {/* Card: Aktivitas Terbaru */}
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex flex-col">
                  <h3 className="font-bold text-[14px] text-[#1f2937] mb-6">Aktivitas Terbaru</h3>

                  <div className="space-y-0 relative mb-6 mt-auto">
                    {/* Vertical Line */}
                    <div className="absolute left-[15px] top-4 bottom-8 w-[1.5px] bg-gray-100"></div>

                    {activities.slice(0, 3).map((act) => (
                      <div key={act.id} className="flex gap-4 relative pb-5">
                        <div className={`w-[32px] h-[32px] ${act.color} rounded-full flex items-center justify-center shrink-0 z-10 border-[3px] border-white`}>
                          {act.icon}
                        </div>
                        <div className="flex-1 pt-0.5">
                          <div className="flex justify-between items-start mb-0.5">
                            <p className="text-[12px] font-bold text-[#1f2937]">{act.title}</p>
                            <span className="text-[10px] text-gray-500 whitespace-nowrap ml-2">{act.date}</span>
                          </div>
                          <p className="text-[11px] text-gray-500">{act.subtitle}</p>
                        </div>
                      </div>
                    ))}
                    {activities.length === 0 && (
                      <p className="text-center text-[12px] text-gray-400 py-6">Belum ada aktivitas.</p>
                    )}
                  </div>

                  <button onClick={() => setActiveMenu('aktivitas')} className="w-full py-2.5 bg-[#0e8a7a]/5 text-[#0e8a7a] hover:bg-[#0e8a7a]/10 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
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
                      <div className="flex justify-between">
                        <span className="text-gray-500">Nomor Kontrak</span>
                        <span className="font-bold text-[#1f2937] truncate pl-2">{formatContractNumber(tenant.contract?.id)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mulai</span>
                        <span className="font-bold text-[#1f2937]">
                          {tenant.contract?.start_date ? new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Berakhir</span>
                        <span className="font-bold text-[#1f2937]">
                          {tenant.contract?.end_date ? new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Durasi</span>
                        <span className="font-bold text-[#1f2937]">
                          {tenant.contract?.rental_duration ? `${tenant.contract.rental_duration} Bulan` : '-'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-600 font-medium">Progres Kontrak</span>
                        <span className="font-bold text-[#1f2937]">{progressPercent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                      </div>
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="font-bold text-[#1f2937]">{daysRemaining} hari tersisa</span>
                        <span className="text-gray-400">dari {tenant.contract?.rental_duration || 0} bulan</span>
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
                   <p className="text-[12px] text-gray-500 mb-4 pb-4 border-b border-gray-100">Lantai {tenant.room?.floor || '-'} • Tipe {tenant.room?.type || '-'}</p>
                   <p className="text-[12px] font-bold text-gray-700 mb-3">Fasilitas Kamar</p>
                   {tenant.room?.description ? (
                     <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-[11px] font-medium text-gray-600">
                       {tenant.room.description.split(',').map((f, idx) => (
                         <div key={idx} className="flex items-center gap-1.5">
                           <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" /> {f.trim()}
                         </div>
                       ))}
                     </div>
                   ) : (
                     <p className="text-[11px] text-gray-400">Tidak ada fasilitas terdaftar.</p>
                   )}
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
                       <span className="font-bold text-[#1f2937]">
                         {tenant.contract?.monthly_rent ? `Rp ${tenant.contract.monthly_rent.toLocaleString('id-ID')}` : '-'}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Deposit</span>
                       <span className="font-bold text-[#1f2937]">
                         {tenant.contract?.deposit ? `Rp ${tenant.contract.deposit.toLocaleString('id-ID')}` : '-'}
                       </span>
                     </div>
                     <div className="flex items-center justify-between">
                       <span className="text-gray-500">Jatuh Tempo</span>
                       <span className="font-bold text-[#1f2937]">
                         {tenant.contract?.payment_due_day ? `Setiap tanggal ${tenant.contract.payment_due_day}` : '-'}
                       </span>
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
                         {tenant.contract ? (
                           <tr className="hover:bg-gray-50/50 transition-colors">
                             <td className="py-4 text-[#1f2937]">
                               {new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} - {new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                             </td>
                             <td className="py-4 text-[#1f2937]">{tenant.contract.rental_duration} Bulan</td>
                             <td className="py-4 text-[#1f2937]">
                               {tenant.contract.monthly_rent ? `Rp ${tenant.contract.monthly_rent.toLocaleString('id-ID')}` : '-'}
                             </td>
                             <td className="py-4">
                               <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${
                                 tenant.contract.status === 'active' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-50'
                               }`}>
                                 {tenant.contract.status === 'active' ? 'Aktif' : 'Selesai'}
                               </span>
                             </td>
                             <td className="py-4 text-[#1f2937]">
                               {new Date(tenant.contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                             </td>
                           </tr>
                         ) : (
                           <tr>
                             <td colSpan={5} className="py-8 text-center text-gray-400">Belum ada riwayat perpanjangan.</td>
                           </tr>
                         )}
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
                       <p className="text-[13px] text-gray-600 leading-relaxed">Jatuh tempo pembayaran adalah sesuai ketentuan jatuh tempo kontrak.</p>
                     </div>
                     <div className="flex items-start gap-3">
                       <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                         <Check className="w-3 h-3 text-white stroke-[3]" />
                       </div>
                       <p className="text-[13px] text-gray-600 leading-relaxed">Pembayaran sewa dapat dilakukan melalui transfer bank atau metode pembayaran yang tersedia.</p>
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
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.date_of_birth ? new Date(tenant.date_of_birth).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Jenis Kelamin</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.gender || '-'}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Alamat</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.address || '-'}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Pekerjaan</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.job || '-'}</span>
                     </div>
                   </div>

                   <button onClick={() => setIsEditing(true)} className="w-full py-2.5 border border-[#0e8a7a] text-[#0e8a7a] hover:bg-[#0e8a7a]/5 rounded-lg text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto">
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
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.emergency_contact_name || '-'}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Hubungan</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.emergency_contact_relation || '-'}</span>
                     </div>
                     <div className="grid grid-cols-[140px_1fr] items-start">
                       <span>Nomor HP/WA</span>
                       <span className="font-medium text-[#1f2937] flex gap-2"><span className="text-gray-400">:</span> {tenant.emergency_contact_phone || '-'}</span>
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
                       <span className="font-medium text-[#1f2937] flex items-center gap-2"><span className="text-gray-400">:</span> 
                         <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${tenant.is_active ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
                           {tenant.is_active ? 'Aktif' : 'Tidak Aktif'}
                         </span>
                       </span>
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
                     <p className="text-[13px] text-gray-400">{tenant.notes || 'Belum ada catatan dari owner.'}</p>
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
                      {tenant.ktp_url ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Terverifikasi</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-md">Belum Diunggah</span>
                      )}
                    </div>
                    <div className="w-full h-[120px] bg-gray-100 rounded-xl mb-4 overflow-hidden relative cursor-pointer group" onClick={() => tenant.ktp_url && setSelectedImage(getImageUrl(tenant.ktp_url))}>
                      {tenant.ktp_url ? (
                        <img src={getImageUrl(tenant.ktp_url)} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="KTP" />
                      ) : (
                        <div className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {tenant.ktp_url && (
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">
                          {tenant.ktp_url ? `${new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:15` : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {tenant.ktp_url ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="w-20">Status</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">Terverifikasi <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                            <span className="w-20">Status</span>
                            <span className="text-gray-400 font-bold flex items-center gap-1">Belum Ada <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div></span>
                          </>
                        )}
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
                      {tenant.selfie_url ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-md">Terverifikasi</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold text-gray-400 bg-gray-100 rounded-md">Belum Diunggah</span>
                      )}
                    </div>
                    <div className="w-full h-[120px] bg-gray-100 rounded-xl mb-4 overflow-hidden relative cursor-pointer group" onClick={() => tenant.selfie_url && setSelectedImage(getImageUrl(tenant.selfie_url))}>
                      {tenant.selfie_url ? (
                        <img src={getImageUrl(tenant.selfie_url)} className="w-full h-full object-cover object-top transition-transform group-hover:scale-105" alt="Selfie" />
                      ) : (
                        <div className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {tenant.selfie_url && (
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">
                          {tenant.selfie_url ? `${new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, 10:16` : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {tenant.selfie_url ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="w-20">Status</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">Terverifikasi <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                            <span className="w-20">Status</span>
                            <span className="text-gray-400 font-bold flex items-center gap-1">Belum Ada <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div></span>
                          </>
                        )}
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
                    <div className="w-full h-[120px] bg-gray-100 rounded-xl mb-4 overflow-hidden relative cursor-pointer group" onClick={() => tenant.additional_doc_url && setSelectedImage(getImageUrl(tenant.additional_doc_url))}>
                      {tenant.additional_doc_url ? (
                        <img src={getImageUrl(tenant.additional_doc_url)} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="Dokumen Tambahan" />
                      ) : (
                        <div className="w-full h-full bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center">
                          <FileText className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      {tenant.additional_doc_url && (
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2 text-[11px] text-gray-500 mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="w-20">Diunggah</span>
                        <span className="text-[#1f2937] font-medium">
                          {tenant.additional_doc_url ? `${new Date(tenant.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : '-'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {tenant.additional_doc_url ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="w-20">Status</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">Ada <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                            <span className="w-20">Status</span>
                            <span className="text-gray-400 font-bold flex items-center gap-1">Belum Ada <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div></span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto space-y-2">
                      <button onClick={() => tenant.additional_doc_url && setSelectedImage(getImageUrl(tenant.additional_doc_url))} className="w-full py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2">
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
                  {tenant.ktp_url && tenant.selfie_url ? (
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
                          <span className="text-gray-400 font-bold">Belum Ada</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#fffbeb] border border-amber-100 rounded-[16px] shadow-sm p-6">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-[15px] text-amber-900 mb-1">Dokumen Belum Lengkap</h3>
                          <p className="text-[12px] text-amber-700 leading-relaxed">Beberapa dokumen identitas wajib belum diunggah.</p>
                        </div>
                      </div>
                      
                      <div className="bg-white rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-gray-600">KTP</span>
                          {tenant.ktp_url ? (
                            <span className="text-emerald-600 font-bold">Terverifikasi</span>
                          ) : (
                            <span className="text-amber-600 font-bold">Belum Diunggah</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-gray-600">Selfie dengan KTP</span>
                          {tenant.selfie_url ? (
                            <span className="text-emerald-600 font-bold">Terverifikasi</span>
                          ) : (
                            <span className="text-amber-600 font-bold">Belum Diunggah</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-gray-600">Dokumen Tambahan</span>
                          <span className="text-gray-400 font-bold">Belum Ada</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp {totalBilled.toLocaleString('id-ID')}</p>
                    <p className="text-[11px] text-gray-400">Total seluruh tagihan</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Sudah Dibayar</h3>
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp {totalPaidSum.toLocaleString('id-ID')}</p>
                    <p className="text-[11px] text-gray-400">Total pembayaran masuk</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Sisa Pembayaran</h3>
                    <p className="font-extrabold text-[18px] text-[#1f2937] mb-1">Rp {totalOutstanding.toLocaleString('id-ID')}</p>
                    <p className="text-[11px] text-gray-400">Masih harus dibayar</p>
                  </div>
                </div>

                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full border-2 border-emerald-500 flex items-center justify-center shrink-0">
                    <Check className={`w-5 h-5 ${!hasUnpaid && payments.length > 0 ? 'text-emerald-500' : 'text-amber-500'} stroke-[3]`} />
                  </div>
                  <div>
                    <h3 className="text-[12px] text-gray-500 font-medium mb-1">Status Pembayaran</h3>
                    <div className="mb-1">
                      <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-md ${paymentStatusColorCard}`}>
                        {paymentStatusLabelCard}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">{hasUnpaid ? 'Ada tunggakan pembayaran' : 'Tidak ada tunggakan'}</p>
                  </div>
                </div>
              </div>

              {/* Tagihan Berjalan */}
              {activeBill ? (
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-emerald-500 flex flex-col xl:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full xl:w-auto">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[13px] text-emerald-600 mb-1">Tagihan Berjalan</h3>
                      <p className="font-bold text-[16px] text-[#1f2937] mb-1">Pembayaran Sewa Bulan {activeBill.period_month} - {activeBill.period_year}</p>
                      <p className="text-[12px] text-gray-500">Periode Bulan {activeBill.period_month} - {activeBill.period_year}</p>
                    </div>
                  </div>

                  <div className="flex w-full xl:w-auto gap-8 justify-between xl:justify-end">
                    <div className="w-px bg-gray-200 hidden md:block"></div>
                    <div>
                      <p className="text-[12px] text-gray-500 mb-1">Jatuh Tempo</p>
                      <p className="font-bold text-[14px] text-[#1f2937] mb-1">
                        {new Date(activeBill.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      {(() => {
                        const daysDiff = Math.ceil((new Date(activeBill.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        if (daysDiff > 0) {
                          return <p className="text-[11px] font-bold text-emerald-600">H-{daysDiff} hari</p>;
                        } else if (daysDiff === 0) {
                          return <p className="text-[11px] font-bold text-amber-500">Hari ini</p>;
                        } else {
                          return <p className="text-[11px] font-bold text-red-500">Terlambat {Math.abs(daysDiff)} hari</p>;
                        }
                      })()}
                    </div>
                    <div className="w-px bg-gray-200 hidden md:block"></div>
                    <div>
                      <p className="text-[12px] text-gray-500 mb-1">Nominal Tagihan</p>
                      <p className="font-bold text-[14px] text-[#1f2937] mb-1">
                        Rp {(activeBill.amount_rent + activeBill.amount_electricity + activeBill.amount_water + activeBill.amount_other).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div className="w-px bg-gray-200 hidden md:block"></div>
                    <div>
                      <p className="text-[12px] text-gray-500 mb-1">Status</p>
                      <div className="mt-1">
                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${activeBillStatusColor}`}>
                          {activeBillStatusLabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-[16px] shadow-sm p-6 border border-gray-100 flex items-center justify-center py-8">
                  <p className="text-[13px] text-gray-400">Tidak ada tagihan berjalan.</p>
                </div>
              )}

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
                      {payments.length > 0 ? (
                        payments.map((p) => {
                          const totalBill = p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
                          return (
                            <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-4 text-gray-600 font-medium">
                                {new Date(p.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-5 py-4 text-[#1f2937]">Pembayaran Sewa Bulan {p.period_month} - {p.period_year}</td>
                              <td className="px-5 py-4 text-gray-600">{p.payment_method || '-'}</td>
                              <td className="px-5 py-4 text-[#1f2937] font-medium">Rp {totalBill.toLocaleString('id-ID')}</td>
                              <td className="px-5 py-4">
                                <span className={`px-2.5 py-1 text-[11px] font-bold rounded-md ${
                                  p.status === 'paid' ? 'text-emerald-600 bg-emerald-50' :
                                  p.status === 'pending' ? 'text-amber-700 bg-amber-100' :
                                  p.status === 'partial' ? 'text-blue-700 bg-blue-100' : 'text-red-700 bg-red-100'
                                }`}>{
                                  p.status === 'paid' ? 'Lunas' :
                                  p.status === 'pending' ? 'Menunggu' :
                                  p.status === 'partial' ? 'Sebagian' : 'Belum Bayar'
                                }</span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 text-xs">-</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-gray-400">Belum ada riwayat pembayaran.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[12px] text-gray-500 font-medium">Menampilkan {payments.length} dari {payments.length} data</span>
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
                <button
                  onClick={() => setActivityFilter('all')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0 ${
                    activityFilter === 'all'
                      ? 'bg-[#0e8a7a]/10 border border-[#0e8a7a] text-[#0e8a7a]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" /> Semua
                </button>
                <button
                  onClick={() => setActivityFilter('pembayaran')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0 ${
                    activityFilter === 'pembayaran'
                      ? 'bg-[#0e8a7a]/10 border border-[#0e8a7a] text-[#0e8a7a]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <Calendar className="w-4 h-4" /> Pembayaran
                </button>
                <button
                  onClick={() => setActivityFilter('kontrak')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0 ${
                    activityFilter === 'kontrak'
                      ? 'bg-[#0e8a7a]/10 border border-[#0e8a7a] text-[#0e8a7a]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <File className="w-4 h-4" /> Kontrak
                </button>
                <button
                  onClick={() => setActivityFilter('check-in')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0 ${
                    activityFilter === 'check-in'
                      ? 'bg-[#0e8a7a]/10 border border-[#0e8a7a] text-[#0e8a7a]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <DoorOpen className="w-4 h-4" /> Check-in
                </button>
                <button
                  onClick={() => setActivityFilter('checkout')}
                  className={`px-4 py-2 rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2 shrink-0 ${
                    activityFilter === 'checkout'
                      ? 'bg-[#0e8a7a]/10 border border-[#0e8a7a] text-[#0e8a7a]'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium'
                  }`}
                >
                  <LogOut className="w-4 h-4" /> Checkout
                </button>
              </div>

              {/* Timeline */}
              <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[20px] top-4 bottom-4 w-px bg-gray-200"></div>

                <div className="space-y-4">
                  {activities
                    .filter((act) => activityFilter === 'all' || act.type === activityFilter)
                    .map((act) => (
                      <div key={act.id} className="relative flex items-start gap-4 xl:gap-6">
                        <div className={`w-10 h-10 rounded-full ${act.color} text-[#1f2937] flex items-center justify-center shrink-0 z-10 border-[3px] border-white shadow-sm mt-1`}>
                          {act.icon}
                        </div>
                        <div className="flex-1 bg-white border border-gray-100 rounded-[12px] shadow-sm p-4 xl:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-[14px] text-[#1f2937] mb-1">{act.title}</h3>
                            <p className="text-[12px] text-gray-500">{act.subtitle}</p>
                          </div>
                          <div className="flex items-center flex-wrap xl:flex-nowrap gap-4 xl:gap-6 shrink-0 text-[12px]">
                            <div className="flex items-center gap-2 text-gray-500 w-[140px]"><Calendar className="w-4 h-4" /> {act.date}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {activities.filter((act) => activityFilter === 'all' || act.type === activityFilter).length === 0 && (
                    <p className="text-center text-gray-400 py-8">Belum ada riwayat aktivitas untuk kategori ini.</p>
                  )}
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

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h3 className="font-display font-extrabold text-[18px] text-brand-navy">Edit Profil Penghuni</h3>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditProfileSubmit} className="p-6 space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={e => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Nomor HP / WA</label>
                  <input
                    type="text"
                    required
                    value={editFormData.phone}
                    onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={editFormData.date_of_birth}
                    onChange={e => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Jenis Kelamin</label>
                  <select
                    value={editFormData.gender}
                    onChange={e => setEditFormData({ ...editFormData, gender: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  >
                    <option value="">Pilih jenis kelamin...</option>
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Pekerjaan / Status</label>
                  <input
                    type="text"
                    value={editFormData.job}
                    onChange={e => setEditFormData({ ...editFormData, job: e.target.value })}
                    placeholder="Contoh: Karyawan, Mahasiswa"
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Alamat Asal</label>
                  <input
                    type="text"
                    value={editFormData.address}
                    onChange={e => setEditFormData({ ...editFormData, address: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                  />
                </div>
              </div>

              {/* Emergency Contact Group */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-bold text-[14px] text-brand-navy mb-3">Kontak Darurat / Kerabat</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Nama Kerabat</label>
                    <input
                      type="text"
                      value={editFormData.emergency_contact_name}
                      onChange={e => setEditFormData({ ...editFormData, emergency_contact_name: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Hubungan</label>
                    <input
                      type="text"
                      value={editFormData.emergency_contact_relation}
                      onChange={e => setEditFormData({ ...editFormData, emergency_contact_relation: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Nomor HP / WA</label>
                    <input
                      type="text"
                      value={editFormData.emergency_contact_phone}
                      onChange={e => setEditFormData({ ...editFormData, emergency_contact_phone: e.target.value })}
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                    />
                  </div>
                </div>
              </div>

              {/* Files Upload Group */}
              <div className="border-t border-gray-100 pt-4">
                <h4 className="font-bold text-[14px] text-brand-navy mb-3">Unggah Dokumen Identitas</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Ganti Foto KTP</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => e.target.files && setEditFiles({ ...editFiles, ktp: e.target.files[0] })}
                      className="text-[11px] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Ganti Foto Selfie</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => e.target.files && setEditFiles({ ...editFiles, selfie: e.target.files[0] })}
                      className="text-[11px] w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Ganti Dokumen Tambahan</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={e => e.target.files && setEditFiles({ ...editFiles, additional_doc: e.target.files[0] })}
                      className="text-[11px] w-full"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Catatan Owner</label>
                <textarea
                  value={editFormData.notes}
                  onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Room Modal */}
      {showChangeRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-display font-extrabold text-[18px] text-brand-navy">Pindah Kamar</h3>
              <button onClick={() => setShowChangeRoomModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleChangeRoomSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-[13px] text-gray-500 mb-4">
                  Pilih kamar baru untuk memindahkan <span className="font-bold text-gray-700">{tenant.name}</span>. Kamar saat ini: <span className="font-bold text-gray-700">Kamar {tenant.room?.room_number || '-'}</span>.
                </p>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Pilih Kamar Baru</label>
                <select
                  required
                  value={selectedRoomId}
                  onChange={e => setSelectedRoomId(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none focus:border-[#0e8a7a]"
                >
                  <option value="">Pilih kamar kosong...</option>
                  {rooms
                    .filter(r => r.status === 'available')
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        Kamar {r.room_number} (Rp {r.price_per_month.toLocaleString('id-ID')}/bln)
                      </option>
                    ))}
                </select>
                {rooms.filter(r => r.status === 'available').length === 0 && (
                  <p className="text-red-500 text-[11px] mt-1.5">Tidak ada kamar kosong yang tersedia saat ini.</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowChangeRoomModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isChangingRoom || rooms.filter(r => r.status === 'available').length === 0}
                  className="px-4 py-2 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2"
                >
                  {isChangingRoom && <Loader2 className="w-4 h-4 animate-spin" />}
                  Pindahkan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Contract Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
              <h3 className="font-display font-extrabold text-[18px] text-brand-navy">Perpanjangan Kontrak</h3>
              <button onClick={() => setShowExtendModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleExtendContractSubmit} className="p-6 space-y-4 flex-1">
              <p className="text-[13px] text-gray-500 mb-4">
                Form perpanjangan kontrak untuk <span className="font-bold text-gray-700">{tenant.name}</span> (Kamar {tenant.room?.room_number || '-'}). Kontrak baru akan membuat tagihan (payment) otomatis.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Tanggal Mulai Kontrak Baru</label>
                  <input
                    type="date"
                    required
                    value={extendData.start_date}
                    onChange={e => setExtendData({ ...extendData, start_date: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Durasi Kontrak Baru (Bulan)</label>
                  <select
                    required
                    value={extendData.rental_duration}
                    onChange={e => setExtendData({ ...extendData, rental_duration: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 12].map(num => (
                      <option key={num} value={num.toString()}>{num} Bulan</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Sewa Bulanan</label>
                  <input
                    type="text"
                    required
                    value={extendData.monthly_rent}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setExtendData({ ...extendData, monthly_rent: digits ? parseInt(digits, 10).toLocaleString('id-ID') : '' });
                    }}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Jatuh Tempo (Tanggal)</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={extendData.payment_due_day}
                    onChange={e => setExtendData({ ...extendData, payment_due_day: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 mt-4">
                <h4 className="font-bold text-[13px] text-brand-navy mb-3">Biaya-Biaya Tambahan Bulanan (Opsional)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Tagihan Listrik</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={extendData.electricity_bill}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setExtendData({ ...extendData, electricity_bill: digits ? parseInt(digits, 10).toLocaleString('id-ID') : '' });
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Tagihan Air</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={extendData.water_bill}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setExtendData({ ...extendData, water_bill: digits ? parseInt(digits, 10).toLocaleString('id-ID') : '' });
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Biaya Lainnya</label>
                    <input
                      type="text"
                      placeholder="0"
                      value={extendData.other_bills}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        setExtendData({ ...extendData, other_bills: digits ? parseInt(digits, 10).toLocaleString('id-ID') : '' });
                      }}
                      className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-[12px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold text-gray-700 mb-1.5">Catatan Perpanjangan</label>
                <textarea
                  value={extendData.notes}
                  onChange={e => setExtendData({ ...extendData, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-[13px] text-brand-navy focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowExtendModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-bold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isExtending}
                  className="px-4 py-2 bg-[#0e8a7a] hover:bg-[#0c7668] text-white rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2"
                >
                  {isExtending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Perpanjang Kontrak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center">
            <h3 className="font-display font-extrabold text-[18px] text-brand-navy mb-2">Konfirmasi Checkout</h3>
            <p className="text-[13px] text-gray-500 mb-6">
              Apakah Anda yakin ingin melakukan checkout untuk <span className="font-bold text-gray-700">{tenant.name}</span>? Tindakan ini akan menonaktifkan status penghuni, mengakhiri kontrak aktif, dan membebaskan kamar.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setShowCheckoutModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[13px] font-bold transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCheckoutSubmit}
                disabled={isCheckingOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[13px] font-bold transition-colors flex items-center gap-2"
              >
                {isCheckingOut && <Loader2 className="w-4 h-4 animate-spin" />}
                Ya, Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 md:-right-12 w-10 h-10 bg-white/10 hover:bg-white text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-md"
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
