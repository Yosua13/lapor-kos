'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api';
import { 
  Users, CheckCircle2, Calendar, AlertTriangle, 
  Search, Plus, LayoutGrid, List as ListIcon, 
  MoreVertical, Phone, ArrowUp, X, Loader2, User, FileText, Image as ImageIcon, Trash2
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  name: string;
  phone: string;
  room_id: string;
  ktp_url: string;
  selfie_url: string;
  contract?: {
    start_date: string;
    end_date: string;
    rental_duration: number;
    status: string;
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

export default function TenantsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expiring' | 'unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name_asc' | 'closest_expiry'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    room_id: '',
    entry_date: new Date().toISOString().split('T')[0],
    rental_duration: '1',
  });
  const [files, setFiles] = useState<{ktp: File | null, selfie: File | null}>({ ktp: null, selfie: null });

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

  // Format Helper
  const getMockPaymentStatus = (name: string) => {
    const code = name.charCodeAt(0) || 0;
    if (code % 4 === 0) return 'Belum Bayar';
    if (code % 4 === 1) return 'Terlambat';
    if (code % 4 === 2) return 'Tepat Waktu';
    return 'Lunas';
  };

  // Enhance Tenants Data with Calculations
  const enhancedTenants = useMemo(() => {
    return tenants.map(t => {
      const entryDate = new Date(t.contract?.start_date || t.created_at);
      const endDate = new Date(t.contract?.end_date || t.created_at);
      
      const now = new Date();
      now.setHours(0,0,0,0);
      const timeDiff = endDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      let contractStatus = 'Aktif';
      let statusColor = 'text-green-600 bg-green-50';
      let cardAccent = 'bg-green-500';
      
      if (daysUntilExpiry < 0) {
        contractStatus = 'Kadaluarsa';
        statusColor = 'text-red-600 bg-red-50';
        cardAccent = 'bg-red-500';
      } else if (daysUntilExpiry <= 30) {
        contractStatus = `Habis ${daysUntilExpiry} Hari`;
        statusColor = 'text-amber-600 bg-amber-50';
        cardAccent = 'bg-amber-500';
      }

      const paymentStatus = getMockPaymentStatus(t.name);
      let paymentColor = 'text-green-600 bg-green-50';
      if (paymentStatus === 'Belum Bayar' || paymentStatus === 'Terlambat') {
        paymentColor = 'text-red-600 bg-red-50';
        cardAccent = 'bg-red-500'; // Override accent to red if unpaid
      } else if (paymentStatus === 'Lunas') {
        paymentColor = 'text-brand-teal bg-brand-teal/10';
      }

      return {
        ...t,
        endDate,
        daysUntilExpiry,
        contractStatus,
        statusColor,
        cardAccent,
        paymentStatus,
        paymentColor,
      };
    });
  }, [tenants]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    return {
      active: enhancedTenants.filter(t => t.daysUntilExpiry >= 0).length,
      newThisMonth: enhancedTenants.filter(t => {
        const d = new Date(t.contract?.start_date || t.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      expiringSoon: enhancedTenants.filter(t => t.daysUntilExpiry >= 0 && t.daysUntilExpiry <= 30).length,
      unpaid: enhancedTenants.filter(t => t.paymentStatus === 'Belum Bayar' || t.paymentStatus === 'Terlambat').length,
    };
  }, [enhancedTenants]);

  // Filtering & Sorting
  const filteredAndSortedTenants = useMemo(() => {
    let result = enhancedTenants;

    // Tab Filter
    if (activeTab === 'active') {
      result = result.filter(t => t.daysUntilExpiry >= 0);
    } else if (activeTab === 'expiring') {
      result = result.filter(t => t.daysUntilExpiry >= 0 && t.daysUntilExpiry <= 30);
    } else if (activeTab === 'unpaid') {
      result = result.filter(t => t.paymentStatus === 'Belum Bayar' || t.paymentStatus === 'Terlambat');
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.room?.room_number.toLowerCase().includes(q)
      );
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'closest_expiry') {
        return a.daysUntilExpiry - b.daysUntilExpiry;
      }
      return 0;
    });

    return result;
  }, [enhancedTenants, activeTab, searchQuery, sortBy]);

  // Handlers for Form
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === '' || val === '+62' || val === '+62-') { setFormData({ ...formData, phone: '' }); return; }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Nama Lengkap wajib diisi.'); return; }
    if (!formData.phone.trim()) { alert('Nomor HP wajib diisi.'); return; }
    if (!formData.room_id) { alert('Kamar wajib dipilih.'); return; }
    if (!formData.entry_date) { alert('Tanggal Masuk wajib diisi.'); return; }
    if (!files.ktp || !files.selfie) { alert('Dokumen KTP dan Selfie wajib diupload.'); return; }

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('phone', formData.phone);
      data.append('email', formData.email);
      data.append('room_id', formData.room_id);
      data.append('entry_date', formData.entry_date);
      data.append('rental_duration', formData.rental_duration);
      if (files.ktp) data.append('ktp', files.ktp);
      if (files.selfie) data.append('selfie', files.selfie);

      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch('http://localhost:8081/api/tenants', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: data
      });

      if (!response.ok) throw new Error('Gagal menambahkan penghuni');
      
      setIsModalOpen(false);
      setFormData({ name: '', phone: '', email: '', room_id: '', entry_date: new Date().toISOString().split('T')[0], rental_duration: '1' });
      setFiles({ ktp: null, selfie: null });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus data penghuni ${name}?`)) return;
    try {
      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const res = await fetch(`http://localhost:8081/api/tenants/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Gagal menghapus penghuni');
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest mb-1">RESIKO & PENGHUNI</p>
          <h1 className="text-3xl font-display font-bold text-brand-navy">Data Penghuni</h1>
          <p className="text-sm text-gray-500 mt-1">Daftar penghuni aktif, manajemen pembayaran, dan riwayat kontrak</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border-[1.5px] border-gray-200 text-brand-navy font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Export
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center gap-2 shadow-sm group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Tambah Penghuni
          </button>
        </div>
      </div>

      {/* STAT CARDS (4 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 group-hover:bg-brand-navy transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-brand-navy"><Users className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-md">Total</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">PENGHUNI AKTIF</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.active}</p>
          <p className="text-xs text-gray-500 mt-1">dari {rooms.length} kamar tersewa</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 group-hover:bg-green-500 transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-500"><CheckCircle2 className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md flex items-center gap-1"><ArrowUp className="w-3 h-3" /> Bulan ini</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">MASUK BULAN INI</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.newThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">Penghuni baru bergabung</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 group-hover:bg-amber-500 transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500"><Calendar className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Perlu aksi</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">KONTRAK SEGERA HABIS</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.expiringSoon}</p>
          <p className="text-xs text-gray-500 mt-1">Dalam 30 hari ke depan</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gray-200 group-hover:bg-red-500 transition-colors"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500"><AlertTriangle className="w-5 h-5" /></div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${stats.unpaid > 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>{stats.unpaid} tagihan</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">TAGIHAN JATUH TEMPO</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.unpaid}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.unpaid > 0 ? 'Perlu tindak lanjut' : 'Semua lunas'}</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-center gap-4 py-2">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'all', label: `Semua (${enhancedTenants.length})` },
            { id: 'active', label: 'Aktif' },
            { id: 'expiring', label: 'Segera Habis' },
            { id: 'unpaid', label: 'Belum Bayar' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-brand-teal shadow-sm' : 'text-gray-500 hover:text-brand-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 flex flex-col md:flex-row items-center gap-3 w-full">
          <div className="relative w-full md:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Cari nama atau kamar..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
            />
          </div>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full md:w-auto bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-2.5 text-xs font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors cursor-pointer"
          >
            <option value="newest">Terbaru masuk</option>
            <option value="name_asc">Nama A-Z</option>
            <option value="closest_expiry">Kontrak terdekat</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <span className="text-xs text-gray-500 font-medium">Menampilkan <b>{filteredAndSortedTenants.length}</b> penghuni</span>
          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><ListIcon className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* CONTENT VIEW */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-brand-teal" /></div>
      ) : filteredAndSortedTenants.length === 0 ? (
        <div className="bg-white border-[1.5px] border-gray-200 border-dashed rounded-[24px] p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"><Users className="w-8 h-8" /></div>
          <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada penghuni</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Data penghuni tidak ditemukan berdasarkan pencarian atau filter yang Anda pilih.</p>
        </div>
      ) : viewMode === 'grid' ? (
        // GRID VIEW
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedTenants.map(tenant => (
            <div key={tenant.id} className="bg-white border-[1.5px] border-gray-200 rounded-[24px] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative group">
              <div className={`h-1.5 w-full ${tenant.cardAccent}`}></div>
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-[14px] bg-gray-100 overflow-hidden shadow-sm">
                        {tenant.selfie_url ? (
                          <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover" />
                        ) : tenant.ktp_url ? (
                          <img src={`http://localhost:8081${tenant.ktp_url}`} alt="KTP" className="w-full h-full object-cover grayscale opacity-50" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-brand-teal text-white font-display font-bold text-lg">
                            {tenant.name.substring(0,2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${tenant.cardAccent}`}></div>
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-brand-navy text-lg leading-tight line-clamp-1">{tenant.name}</h3>
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold mt-1 ${
                        tenant.cardAccent.includes('amber') ? 'bg-amber-50 text-amber-600' :
                        tenant.cardAccent.includes('red') ? 'bg-red-50 text-red-600' :
                        'bg-brand-teal/10 text-brand-teal'
                      }`}>
                        Kamar {tenant.room?.room_number || '-'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(tenant.id, tenant.name)} title="Hapus Data" className="text-red-400 hover:text-red-600 p-1 transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                    <Phone className="w-3.5 h-3.5" /> {tenant.phone}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Calendar className="w-3.5 h-3.5" /> Masuk <span className="font-bold text-brand-navy">{new Date(tenant.contract?.start_date || tenant.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</span> 
                    · habis <span className="font-bold text-brand-navy">{tenant.endDate.toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${tenant.statusColor}`}>• {tenant.contractStatus}</span>
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${tenant.paymentColor}`}>• {tenant.paymentStatus}</span>
                </div>

                {/* Payment status visual */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-medium">Tagihan bulan ini</span>
                    <span className={`font-bold ${
                      tenant.paymentStatus === 'Lunas' || tenant.paymentStatus === 'Tepat Waktu' 
                        ? 'text-emerald-600' 
                        : 'text-red-600'
                    }`}>
                      {tenant.paymentStatus === 'Lunas' || tenant.paymentStatus === 'Tepat Waktu' 
                        ? '✓ Lunas' 
                        : `Belum — Rp ${(tenant.room?.price_per_month || 0).toLocaleString('id-ID')}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[10px] font-bold border-t border-dashed border-gray-200 pt-4">
                  <div className="flex items-center gap-1">
                    {tenant.ktp_url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={tenant.ktp_url ? "text-green-600" : "text-red-500"}>{tenant.ktp_url ? 'KTP' : 'KTP blm ada'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {tenant.selfie_url ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-red-500" />}
                    <span className={tenant.selfie_url ? "text-green-600" : "text-red-500"}>{tenant.selfie_url ? 'Selfie' : 'Selfie blm ada'}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                <button 
                  onClick={() => tenant.ktp_url && window.open(`http://localhost:8081${tenant.ktp_url}`, '_blank')}
                  className="flex-1 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5" /> Dok. KTP
                </button>
                <button 
                  onClick={() => router.push(`/tenants/${tenant.id}`)}
                  className="flex-1 py-2 text-xs font-bold text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <User className="w-3.5 h-3.5" /> Detail Profil
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        // LIST VIEW
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Penghuni</th>
                  <th className="px-6 py-4">Kamar</th>
                  <th className="px-6 py-4">Kontak</th>
                  <th className="px-6 py-4">Status Kontrak</th>
                  <th className="px-6 py-4">Status Bayar</th>
                  <th className="px-6 py-4">Dokumen</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedTenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[10px] bg-brand-teal/10 overflow-hidden flex items-center justify-center">
                          {tenant.selfie_url ? (
                            <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover" />
                          ) : <User className="w-5 h-5 text-brand-teal" />}
                        </div>
                        <div>
                          <p className="font-bold text-brand-navy">{tenant.name}</p>
                          <p className="text-[10px] text-gray-400">Sejak {new Date(tenant.contract?.start_date || tenant.created_at).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'})}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                        tenant.cardAccent.includes('amber') ? 'bg-amber-50 text-amber-600' :
                        tenant.cardAccent.includes('red') ? 'bg-red-50 text-red-600' :
                        'bg-brand-teal/10 text-brand-teal'
                      }`}>
                        Kamar {tenant.room?.room_number || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-600">{tenant.phone}</td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-[10px] font-bold ${tenant.statusColor}`}>• {tenant.contractStatus}</span></td>
                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded-md text-[10px] font-bold ${tenant.paymentColor}`}>• {tenant.paymentStatus}</span></td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1.5">
                        <div title="KTP" className={`w-5 h-5 rounded flex items-center justify-center ${tenant.ktp_url ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}><FileText className="w-3 h-3" /></div>
                        <div title="Selfie" className={`w-5 h-5 rounded flex items-center justify-center ${tenant.selfie_url ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'}`}><ImageIcon className="w-3 h-3" /></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleDelete(tenant.id, tenant.name)}
                          className="px-2 py-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => router.push(`/tenants/${tenant.id}`)}
                          className="px-3 py-1.5 text-xs font-bold text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/20 rounded-lg transition-colors"
                        >
                          Detail Profil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PENGHUNI */}
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
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-brand-navy transition-colors p-2 rounded-full hover:bg-gray-100 z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mb-6 shrink-0">
              <span className="inline-block px-2.5 py-1 bg-brand-teal/10 text-brand-teal text-[10px] font-extrabold uppercase tracking-widest rounded-md mb-2">
                REGISTRASI PENGHUNI
              </span>
              <h3 className="text-2xl font-display font-bold text-brand-navy leading-tight">
                Tambah Penghuni Baru
              </h3>
              <p className="text-gray-500 text-xs mt-1 font-medium">
                Lengkapi data identitas dan dokumen pendukung
              </p>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div
                className="space-y-6 overflow-y-auto pr-2 flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden pb-4"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                
                {/* GRUP 1: DATA DIRI */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DATA DIRI</span>
                    <div className="h-[1.5px] w-full bg-gray-200"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Nama Lengkap <span className="text-red-500">*</span></label>
                      <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm" placeholder="Contoh: Budi Santoso" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Nomor HP / WA <span className="text-red-500">*</span></label>
                      <input required type="text" value={formData.phone} onChange={handlePhoneChange} placeholder="+62-8xx-xxxx-xxxx" className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="block text-xs font-bold text-brand-navy">Email Penghuni <span className="text-gray-400">(Opsional untuk login portal)</span></label>
                      <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm" placeholder="Contoh: budi.santoso@gmail.com" />
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
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Kamar Tersedia <span className="text-red-500">*</span></label>
                      <select required value={formData.room_id} onChange={(e) => setFormData({...formData, room_id: e.target.value})} className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all cursor-pointer shadow-sm">
                        <option value="">— Pilih Kamar —</option>
                        {rooms.filter(r => r.status === 'available').map(room => (
                          <option key={room.id} value={room.id}>Kamar {room.room_number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Tanggal Masuk <span className="text-red-500">*</span></label>
                      <input required type="date" value={formData.entry_date} onChange={(e) => setFormData({...formData, entry_date: e.target.value})} className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Durasi Sewa <span className="text-red-500">*</span></label>
                      <select required value={formData.rental_duration} onChange={(e) => setFormData({...formData, rental_duration: e.target.value})} className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all cursor-pointer shadow-sm">
                        <option value="1">1 Bulan</option>
                        <option value="3">3 Bulan</option>
                        <option value="6">6 Bulan</option>
                        <option value="12">12 Bulan (1 Tahun)</option>
                      </select>
                      {formData.entry_date && (
                        <p className="text-[10px] text-brand-teal font-medium mt-1">
                          Berakhir: {
                            (() => {
                              const end = new Date(formData.entry_date);
                              end.setMonth(end.getMonth() + parseInt(formData.rental_duration));
                              return end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                            })()
                          }
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {formData.room_id && (
                    <div className="mt-4 bg-brand-teal/5 border border-brand-teal/20 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">Total Harga (Sewa x Durasi)</p>
                        <p className="text-xl font-display font-bold text-brand-teal">
                          {(() => {
                            const selectedRoom = rooms.find(r => r.id === formData.room_id);
                            const price = selectedRoom ? selectedRoom.price_per_month : 0;
                            const total = price * parseInt(formData.rental_duration);
                            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total);
                          })()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* GRUP 3: DOKUMEN IDENTITAS */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DOKUMEN IDENTITAS</span>
                    <div className="h-[1.5px] w-full bg-gray-200"></div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                    <div className="space-y-1">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ktp')} className="hidden" id="ktp-upload" />
                      <label htmlFor="ktp-upload" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${files.ktp ? 'border-green-500 bg-[#f0faf8]' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'}`}>
                        {files.ktp ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-500 mb-1" />
                            <span className="text-[10px] font-bold text-brand-navy">{files.ktp.name}</span>
                            <span className="text-[9px] text-gray-500 font-medium">Klik untuk ganti file</span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center mb-2"><FileText className="w-4 h-4 text-brand-teal" /></div>
                            <span className="text-xs font-bold text-brand-navy">Upload KTP <span className="text-red-500">*</span></span>
                            <span className="text-[9px] text-gray-500 font-medium">Format: JPG, PNG, PDF</span>
                          </>
                        )}
                      </label>
                    </div>
                    <div className="space-y-1">
                      <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" id="selfie-upload" />
                      <label htmlFor="selfie-upload" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${files.selfie ? 'border-green-500 bg-[#f0faf8]' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'}`}>
                        {files.selfie ? (
                          <>
                            <CheckCircle2 className="w-5 h-5 text-green-500 mb-1" />
                            <span className="text-[10px] font-bold text-brand-navy">{files.selfie.name}</span>
                            <span className="text-[9px] text-gray-500 font-medium">Klik untuk ganti file</span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center mb-2"><ImageIcon className="w-4 h-4 text-brand-teal" /></div>
                            <span className="text-xs font-bold text-brand-navy">Foto Selfie (Pegang KTP) <span className="text-red-500">*</span></span>
                            <span className="text-[9px] text-gray-500 font-medium">Format: JPG, PNG</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

              </div>
              <div className="bg-[#faf8f5] border-t border-gray-200 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                <span className="text-[10px] text-gray-500 font-medium"><span className="text-red-500">*</span> Field wajib diisi</span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 border-[1.5px] border-gray-300 hover:border-gray-400 text-brand-navy font-bold rounded-[9px] transition-all text-xs bg-white shadow-sm">Batal</button>
                  <button type="submit" disabled={isSubmitting} className="px-5 py-2 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-[9px] shadow-md shadow-brand-teal/20 transition-all flex items-center gap-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="font-bold">✓</span>}
                    <span>Simpan Data</span>
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
