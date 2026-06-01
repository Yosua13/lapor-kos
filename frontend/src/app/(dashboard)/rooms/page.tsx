'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  DoorOpen,
  X,
  ChevronRight,
  Phone,
  Calendar,
  Image as ImageIcon,
  Users,
  CheckCircle2,
  LayoutGrid,
  List as ListIcon,
  TrendingUp,
  Key,
  Home
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Room {
  id: string;
  room_number: string;
  price_per_month: number;
  description: string;
  status: string;
}

export default function RoomsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Filter & View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'occupied'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'number_asc' | 'price_asc' | 'price_desc'>('number_asc');

  // 2-Step Form state
  const [step, setStep] = useState(1);
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, roomId: string, hasTenant: boolean}>({isOpen: false, roomId: '', hasTenant: false});

  // Room Form state
  const [formData, setFormData] = useState({
    room_number: '',
    price_per_month: '',
    description: '',
    status: 'available'
  });

  const [facilities, setFacilities] = useState<string[]>([]);
  const [facilityInput, setFacilityInput] = useState('');
  const SUGGESTIONS = ['AC', 'WiFi', 'Kasur', 'Lemari Pakaian', 'Meja Belajar', 'Kursi', 'Kamar Mandi Dalam', 'Water Heater', 'Kulkas', 'Dapur Dalam', 'Parkir Motor', 'Parkir Mobil', 'Kolam Renang', 'Gym', 'Laundry', 'Security 24/7', 'CCTV', 'Bantal', 'Guling', 'Selimut', 'Peralatan Masak', 'Peralatan Makan', 'Peralatan Mandi', 'Meja Makan', ' Kursi Makan'];

  // Tenant Form state
  const [tenantFormData, setTenantFormData] = useState({
    name: '',
    phone: '',
    email: '',
    entry_date: new Date().toISOString().split('T')[0],
    rental_duration: '1'
  });
  const [files, setFiles] = useState<{ ktp: File | null, selfie: File | null }>({
    ktp: null,
    selfie: null
  });

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const [roomsData, tenantsData] = await Promise.all([
        apiFetch('/api/rooms'),
        apiFetch('/api/tenants')
      ]);
      setRooms(roomsData || []);
      setTenants(tenantsData || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data kamar');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to find tenant for a room
  const getTenantForRoom = (roomId: string) => {
    return tenants.find(t => t.room_id === roomId || t.room?.id === roomId);
  };

  useEffect(() => {
    setMounted(true);
    fetchRooms();
  }, []);

  const stats = useMemo(() => {
    const total = rooms.length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const available = rooms.filter(r => r.status === 'available').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, available, occupancyRate };
  }, [rooms]);

  const filteredAndSortedRooms = useMemo(() => {
    let result = rooms;

    if (activeTab === 'available') result = result.filter(r => r.status === 'available');
    else if (activeTab === 'occupied') result = result.filter(r => r.status === 'occupied');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => r.room_number.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (sortBy === 'price_asc') return a.price_per_month - b.price_per_month;
      if (sortBy === 'price_desc') return b.price_per_month - a.price_per_month;
      return a.room_number.localeCompare(b.room_number, undefined, {numeric: true});
    });

    return result;
  }, [rooms, activeTab, searchQuery, sortBy]);

  const handleOpenModal = (room?: Room) => {
    setStep(1);
    setTenantFormData({
      name: '',
      phone: '',
      email: '',
      entry_date: new Date().toISOString().split('T')[0],
      rental_duration: '1',
    });
    setFiles({ ktp: null, selfie: null });

    if (room) {
      setEditingRoom(room);
      setFormData({
        room_number: room.room_number,
        price_per_month: room.price_per_month.toString(),
        description: room.description,
        status: room.status
      });
      setFacilities(room.description ? room.description.split(',').map(s => s.trim()).filter(Boolean) : []);
    } else {
      setEditingRoom(null);
      setFormData({
        room_number: '',
        price_per_month: '',
        description: '',
        status: 'available'
      });
      setFacilities([]);
    }
    setIsModalOpen(true);
  };

  const handleAddFacility = (tag: string) => {
    if (tag.trim() && !facilities.includes(tag.trim())) {
      setFacilities([...facilities, tag.trim()]);
    }
    setFacilityInput('');
  };

  const handleFacilityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFacility(facilityInput);
    }
  };

  const handleRemoveFacility = (tag: string) => {
    setFacilities(facilities.filter(f => f !== tag));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (!val) {
      setFormData({ ...formData, price_per_month: '' });
      return;
    }
    if (val.length > 7) {
      val = val.slice(0, 7);
    }
    setFormData({ ...formData, price_per_month: val });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRoom && formData.status === 'occupied') {
      setStep(2);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        price_per_month: parseFloat(formData.price_per_month),
        description: facilities.join(', ')
      };

      if (editingRoom) {
        await apiFetch(`/api/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      fetchRooms();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tenantFormData.name || tenantFormData.name.trim() === '') { alert('Nama Lengkap wajib diisi.'); return; }
    if (!tenantFormData.phone || tenantFormData.phone.trim() === '') { alert('Nomor HP / WA wajib diisi.'); return; }
    const rawDigits = tenantFormData.phone.replace(/\D/g, '');
    if (rawDigits.length - 2 < 10) { alert('Nomor HP / WA minimal harus 10 digit angka.'); return; }
    if (!tenantFormData.entry_date || tenantFormData.entry_date.trim() === '') { alert('Tanggal Masuk wajib diisi.'); return; }
    if (!files.ktp) { alert('Dokumen KTP wajib diupload.'); return; }
    if (!files.selfie) { alert('Foto Selfie wajib diupload.'); return; }

    setIsSubmittingTenant(true);

    try {
      const data = new FormData();
      data.append('room_number', formData.room_number);
      data.append('price_per_month', formData.price_per_month);
      data.append('description', facilities.join(', '));
      data.append('status', formData.status);

      data.append('name', tenantFormData.name);
      data.append('phone', tenantFormData.phone);
      data.append('email', tenantFormData.email);
      data.append('entry_date', tenantFormData.entry_date);
      data.append('rental_duration', tenantFormData.rental_duration);
      if (files.ktp) data.append('ktp', files.ktp);
      if (files.selfie) data.append('selfie', files.selfie);

      const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];
      const response = await fetch('http://localhost:8081/api/rooms/with-tenant', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: data
      });

      if (!response.ok) throw new Error('Gagal menambah kamar dan penghuni');

      setIsModalOpen(false);
      fetchRooms();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmittingTenant(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'ktp' | 'selfie') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val === '' || val === '+62' || val === '+62-') {
      setTenantFormData({ ...tenantFormData, phone: '' });
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
    setTenantFormData({ ...tenantFormData, phone: formatted });
  };

  const handleDeleteClick = (room: Room) => {
    setDeleteModal({
      isOpen: true,
      roomId: room.id,
      hasTenant: room.status === 'occupied'
    });
  }

  const confirmDelete = async (deleteTenant: boolean) => {
    try {
      await apiFetch(`/api/rooms/${deleteModal.roomId}?delete_tenant=${deleteTenant}`, { method: 'DELETE' });
      fetchRooms();
      setDeleteModal({isOpen: false, roomId: '', hasTenant: false});
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kamar');
    }
  }

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest mb-1">DATA INVENTORI</p>
          <h1 className="text-3xl font-display font-bold text-brand-navy">Manajemen Kamar</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola ketersediaan dan informasi kamar kos Anda</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border-[1.5px] border-gray-200 text-brand-navy font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Export
          </button>
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center gap-2 shadow-sm group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Tambah Kamar
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 group-hover:scale-110 transition-transform"><Home className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">Total: {stats.total}</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">TOTAL KAMAR</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.total}</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-slate-400 rounded-full" style={{ width: '100%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{stats.total} terdaftar</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 group-hover:scale-110 transition-transform"><Users className="w-5 h-5" /></div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${stats.occupancyRate >= 50 ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>{stats.occupancyRate}%</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">KAMAR TERISI</p>
          <div className="flex items-baseline gap-1">
            <p className="text-3xl font-display font-bold text-brand-navy">{stats.occupied}</p>
            <span className="text-brand-navy/20 font-bold text-lg">/{stats.total}</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className={`h-full rounded-full transition-all duration-700 ${stats.occupancyRate >= 50 ? 'bg-brand-teal' : 'bg-amber-500'}`} style={{ width: `${stats.occupancyRate}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">{stats.available} kamar kosong</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform"><Key className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">Siap Huni</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">KAMAR KOSONG</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.available}</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-amber-400 rounded-full transition-all duration-700" style={{ width: `${stats.total > 0 ? (stats.available / stats.total) * 100 : 0}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Menunggu penghuni</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><TrendingUp className="w-5 h-5" /></div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${stats.occupancyRate >= 70 ? 'bg-emerald-50 text-emerald-700' : stats.occupancyRate >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>Efisiensi</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">TINGKAT HUNIAN</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.occupancyRate}%</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className={`h-full rounded-full transition-all duration-700 ${stats.occupancyRate >= 70 ? 'bg-emerald-500' : stats.occupancyRate >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${stats.occupancyRate}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Rasio kamar terisi</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-center gap-4 py-2">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'all', label: `Semua (${stats.total})` },
            { id: 'available', label: 'Tersedia' },
            { id: 'occupied', label: 'Terisi' }
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
              placeholder="Cari nomor kamar..." 
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
            <option value="number_asc">Nomor Kamar</option>
            <option value="price_asc">Harga Terendah</option>
            <option value="price_desc">Harga Tertinggi</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <span className="text-xs text-gray-500 font-medium">Menampilkan <b>{filteredAndSortedRooms.length}</b> kamar</span>
          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><ListIcon className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* CONTENT VIEW */}
      {isLoading && rooms.length === 0 ? (
        <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-brand-teal" /></div>
      ) : filteredAndSortedRooms.length === 0 ? (
        <div className="bg-white border-[1.5px] border-gray-200 border-dashed rounded-[24px] p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"><DoorOpen className="w-8 h-8" /></div>
          <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada kamar</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Data kamar tidak ditemukan berdasarkan pencarian atau filter yang Anda pilih.</p>
        </div>
      ) : viewMode === 'grid' ? (
        // GRID VIEW
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedRooms.map(room => {
            const tenant = getTenantForRoom(room.id);
            const isOccupied = room.status === 'occupied';
            return (
            <div key={room.id} className="bg-white border-[1.5px] border-gray-200 rounded-[20px] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative group" style={{ borderLeft: `3px solid ${isOccupied ? '#0e8a7a' : '#f59e0b'}` }}>
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-display font-bold text-brand-navy text-lg leading-tight">Kamar {room.room_number}</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5">Lantai {room.room_number.length > 1 ? room.room_number[0] : '1'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                      isOccupied ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200' : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isOccupied ? 'bg-teal-500' : 'bg-amber-500'}`} />
                      {isOccupied ? 'Terisi' : 'Kosong'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleOpenModal(room)} className="p-1.5 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteClick(room)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>

                {/* Tenant Info (for occupied rooms) */}
                {isOccupied && tenant ? (
                  <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-teal/10 overflow-hidden flex items-center justify-center shrink-0">
                      {tenant.selfie_url ? (
                        <img src={`http://localhost:8081${tenant.selfie_url}`} alt={tenant.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-brand-teal font-bold text-xs">{tenant.name?.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-brand-navy truncate">{tenant.name}</p>
                      <p className="text-[10px] text-gray-400">s/d {tenant.contract?.end_date ? new Date(tenant.contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</p>
                    </div>
                  </div>
                ) : !isOccupied ? (
                  <button 
                    onClick={() => router.push('/tenants')}
                    className="w-full py-2.5 mb-4 border-[1.5px] border-dashed border-gray-300 hover:border-brand-teal text-gray-400 hover:text-brand-teal rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Penghuni
                  </button>
                ) : null}

                <div className="flex justify-between items-center">
                  <p className="text-sm font-bold text-brand-navy">Rp {room.price_per_month.toLocaleString('id-ID')}<span className="text-[10px] font-medium text-gray-400 font-sans">/bln</span></p>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {(room.description ? room.description.split(',') : []).slice(0, 2).map((facility, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded bg-gray-50 text-gray-500 text-[9px] font-medium border border-gray-100">
                        {facility.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        // LIST VIEW
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Nomor Kamar</th>
                  <th className="px-6 py-4">Harga/Bulan</th>
                  <th className="px-6 py-4">Deskripsi</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedRooms.map(room => (
                  <tr key={room.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center font-bold ${room.status === 'occupied' ? 'bg-brand-teal/10 text-brand-teal' : 'bg-amber-50 text-amber-600'}`}>
                          {room.room_number.slice(-2)}
                        </div>
                        <div>
                          <p className="font-bold text-brand-navy">Kamar {room.room_number}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-brand-navy">
                      Rp {room.price_per_month.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate">
                      {room.description || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                        room.status === 'occupied' ? 'bg-brand-teal/10 text-brand-teal' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {room.status === 'occupied' ? 'TERISI' : 'KOSONG'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(room)} className="p-1.5 text-gray-400 hover:text-brand-teal hover:bg-brand-teal/10 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteClick(room)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal rendered via Portal to escape parent CSS stacking contexts */}
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
                {step === 1 ? 'FORM UNIT' : 'REGISTRASI PENGHUNI'}
              </span>
              <h3 className="text-2xl font-display font-bold text-brand-navy leading-tight">
                {step === 1 ? (editingRoom ? 'Perbarui Kamar' : 'Tambah Kamar Baru') : 'Tambah Penghuni Baru'}
              </h3>
              <p className="text-gray-500 text-xs mt-1 font-medium">
                {step === 1 ? 'Lengkapi informasi dan ketersediaan kamar' : 'Lengkapi data identitas dan dokumen pendukung'}
              </p>
            </div>

            {step === 1 ? (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div
                  className="space-y-6 overflow-y-auto pr-2 flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Nomor Kamar <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.room_number}
                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                        placeholder="E.g. 101"
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Harga (Rp/Bln) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={formData.price_per_month ? `Rp. ${parseInt(formData.price_per_month).toLocaleString('id-ID')}` : ''}
                        onChange={handlePriceChange}
                        placeholder="Rp. 1.500.000"
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-brand-navy">Status Ketersediaan <span className="text-red-500">*</span></label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      disabled={!!editingRoom}
                      className={`w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm ${editingRoom ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'cursor-pointer'}`}
                    >
                      <option value="available">TERSEDIA (KOSONG)</option>
                      <option value="occupied">TERISI</option>
                    </select>
                    {editingRoom && (
                      <p className="text-[10px] text-gray-500 font-medium">Status otomatis berubah jika penghuni ditambah/dihapus.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-brand-navy">Fasilitas Kamar</label>
                    <div className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] p-2 focus-within:border-brand-teal focus-within:ring-4 focus-within:ring-brand-teal/10 transition-all shadow-sm flex flex-col gap-2">
                      <div className="flex flex-wrap gap-2">
                        {facilities.map(tag => (
                          <div key={tag} className="flex items-center gap-1.5 bg-brand-navy/5 px-2.5 py-1 rounded-md">
                            <span className="text-[11px] font-bold text-brand-navy">{tag}</span>
                            <button type="button" onClick={() => handleRemoveFacility(tag)} className="text-brand-navy/40 hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={facilityInput}
                        onChange={(e) => setFacilityInput(e.target.value)}
                        onKeyDown={handleFacilityKeyDown}
                        placeholder={facilities.length === 0 ? "Ketik fasilitas lalu Enter (misal: AC)..." : "Tambah fasilitas lain..."}
                        className="w-full bg-transparent border-none py-1 px-1.5 text-brand-navy font-semibold text-xs focus:outline-none placeholder:text-gray-400"
                      />
                    </div>
                    {facilityInput && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {SUGGESTIONS.filter(s => s.toLowerCase().includes(facilityInput.toLowerCase()) && !facilities.includes(s)).map(s => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => handleAddFacility(s)}
                            className="text-[10px] bg-brand-teal/5 text-brand-teal hover:bg-brand-teal/10 font-bold px-2 py-1 rounded-md border border-brand-teal/20 transition-colors"
                          >
                            + {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#faf8f5] border-t border-gray-200 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                  <span className="text-[10px] text-gray-500 font-medium"><span className="text-red-500">*</span> Field wajib diisi</span>
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
                      disabled={isLoading}
                      className="px-5 py-2 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-[9px] shadow-md shadow-brand-teal/20 transition-all flex items-center gap-2 text-xs"
                    >
                      {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="font-bold">✓</span>}
                      <span>{!editingRoom && formData.status === 'occupied' ? 'Simpan & Lanjut' : 'Simpan Data'}</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleTenantSubmit} className="flex-1 flex flex-col justify-between overflow-hidden">
                <div
                  className="space-y-6 overflow-y-auto pr-2 flex-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DATA DIRI</span>
                      <div className="h-[1.5px] w-full bg-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-brand-navy">Nama Lengkap <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={tenantFormData.name}
                          onChange={(e) => setTenantFormData({ ...tenantFormData, name: e.target.value })}
                          placeholder="E.g. Andi Setiawan"
                          className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-brand-navy">Nomor HP / WA <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={tenantFormData.phone}
                          onChange={handlePhoneChange}
                          placeholder="+62-8xx-xxxx-xxxx"
                          className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="block text-xs font-bold text-brand-navy">Email Penghuni <span className="text-gray-400">(Opsional untuk login portal)</span></label>
                        <input
                          type="email"
                          value={tenantFormData.email}
                          onChange={(e) => setTenantFormData({ ...tenantFormData, email: e.target.value })}
                          className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all placeholder:text-gray-400 shadow-sm"
                          placeholder="Contoh: budi.santoso@gmail.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">INFORMASI PENYEWAAN</span>
                      <div className="h-[1.5px] w-full bg-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-brand-navy">Kamar Terpilih</label>
                        <div className="w-full bg-gray-100 border-[1.5px] border-gray-200 rounded-[9px] py-2.5 px-3.5 text-gray-500 font-semibold text-xs">
                          Kamar {formData.room_number}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-brand-navy">Tanggal Masuk <span className="text-red-500">*</span></label>
                        <input
                          type="date"
                          required
                          value={tenantFormData.entry_date}
                          onChange={(e) => setTenantFormData({ ...tenantFormData, entry_date: e.target.value })}
                          className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-xs font-bold text-brand-navy">Durasi Sewa <span className="text-red-500">*</span></label>
                        <select
                          required
                          value={tenantFormData.rental_duration}
                          onChange={(e) => setTenantFormData({ ...tenantFormData, rental_duration: e.target.value })}
                          className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm cursor-pointer"
                        >
                          <option value="1">1 Bulan</option>
                          <option value="3">3 Bulan</option>
                          <option value="6">6 Bulan</option>
                          <option value="12">12 Bulan (1 Tahun)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest whitespace-nowrap">DOKUMEN IDENTITAS</span>
                      <div className="h-[1.5px] w-full bg-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                      <div className="space-y-1">
                        <div className="relative">
                          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ktp')} className="hidden" id="ktp-upload-room" />
                          <label htmlFor="ktp-upload-room" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${files.ktp ? 'border-green-500 bg-[#f0faf8]' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'}`}>
                            {files.ktp && <span className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Terupload</span>}
                            <div className="text-2xl mb-1">{files.ktp ? '✅' : '🪪'}</div>
                            <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">Dokumen KTP <span className="text-red-500">*</span></p>
                            <p className={`text-[9px] text-center ${files.ktp ? 'text-green-600 font-semibold truncate max-w-[140px]' : 'text-gray-500 font-medium'}`}>{files.ktp ? files.ktp.name : 'Klik untuk pilih foto'}</p>
                          </label>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="relative">
                          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" id="selfie-upload-room" />
                          <label htmlFor="selfie-upload-room" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] p-3.5 cursor-pointer transition-all shadow-sm ${files.selfie ? 'border-green-500 bg-[#f0faf8]' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white'}`}>
                            {files.selfie && <span className="absolute top-2 right-2 bg-green-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Terupload</span>}
                            <div className="text-2xl mb-1">{files.selfie ? '✅' : '🤳'}</div>
                            <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">Foto Selfie <span className="text-red-500">*</span></p>
                            <p className={`text-[9px] text-center ${files.selfie ? 'text-green-600 font-semibold truncate max-w-[140px]' : 'text-gray-500 font-medium'}`}>{files.selfie ? files.selfie.name : 'Klik untuk pilih foto'}</p>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-[#faf8f5] border-t border-gray-200 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                  <span className="text-[10px] text-gray-500 font-medium"><span className="text-red-500">*</span> Field wajib diisi</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 border-[1.5px] border-gray-300 hover:border-gray-400 text-brand-navy font-bold rounded-[9px] transition-all text-xs bg-white shadow-sm"
                    >
                      Kembali
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTenant}
                      className="px-5 py-2 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-[9px] shadow-md shadow-brand-teal/20 transition-all flex items-center gap-2 text-xs"
                    >
                      {isSubmittingTenant ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="font-bold">✓</span>}
                      <span>Simpan Data Penghuni</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300" style={{ backgroundColor: 'rgba(11, 31, 53, 0.45)', backdropFilter: 'blur(6px)' }}>
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl animate-slide-up relative">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4 border-4 border-red-50">
               <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-brand-navy mb-2">Hapus Kamar</h3>
            {deleteModal.hasTenant ? (
              <>
                <p className="text-sm text-gray-600 mb-6">Terdapat penghuni di kamar tersebut. Apakah Anda juga ingin menghapus data penghuni ini secara permanen?</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => confirmDelete(true)} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors">Ya, Hapus Kamar & Penghuni</button>
                  <button onClick={() => confirmDelete(false)} className="w-full bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-2.5 rounded-xl transition-colors">Tidak, Hapus Kamar Saja</button>
                  <button onClick={() => setDeleteModal({isOpen: false, roomId: '', hasTenant: false})} className="w-full text-gray-400 hover:text-gray-600 font-bold py-2.5 rounded-xl transition-colors mt-2 text-xs">Batal</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-6">Apakah Anda yakin ingin menghapus data kamar ini secara permanen?</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteModal({isOpen: false, roomId: '', hasTenant: false})} className="flex-1 border-[1.5px] border-gray-200 hover:bg-gray-50 text-gray-600 font-bold py-2.5 rounded-xl transition-colors">Batal</button>
                  <button onClick={() => confirmDelete(false)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors">Hapus Kamar</button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
