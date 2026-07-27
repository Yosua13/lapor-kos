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
  ChevronLeft,
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
  Home,
  Armchair,
  ExternalLink,
  Wallet,
  Download,
  ChevronDown,
  CheckSquare
} from 'lucide-react';
import { apiFetch, getImageUrl } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';

interface Room {
  id: string;
  room_number: string;
  price_per_month: number;
  description: string;
  status: string;
  type?: string;
  floor?: string;
  activeContract?: {
    end_date: string;
    user?: {
      id?: string;
      name: string;
    };
  };
}

export default function RoomsPage() {
  const router = useRouter();
  const { can } = useAuthorization();
  const canWriteRooms = can(CAPABILITIES.ROOM_WRITE);
  const [mounted, setMounted] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  // Filter & View State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [activeTab, setActiveTab] = useState<'all' | 'available' | 'occupied'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'number_asc' | 'number_desc' | 'price_asc' | 'price_desc'>('number_asc');
  const [filterFloor, setFilterFloor] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeMenuRoomId, setActiveMenuRoomId] = useState<string | null>(null);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 2-Step Form state
  const [step, setStep] = useState(1);
  const [isSubmittingTenant, setIsSubmittingTenant] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, roomId: string, hasTenant: boolean}>({isOpen: false, roomId: '', hasTenant: false});

  // Room Form state
  const [formData, setFormData] = useState({
    room_number: '',
    price_per_month: '',
    description: '',
    status: 'available',
    type: '',
    floor: ''
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
        apiFetch('/api/contracts?status=active')
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
    const contract = tenants.find(c => c.room_id === roomId);
    if (contract) return { ...contract.user, contract: contract };
    return undefined;
  };

  useEffect(() => {
    setMounted(true);
    fetchRooms();
  }, []);



  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterFloor, filterType, searchQuery, sortBy, itemsPerPage]);

  const stats = useMemo(() => {
    const total = rooms.length;
    const occupied = rooms.filter(r => r.status === 'occupied').length;
    const available = rooms.filter(r => r.status === 'available').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, available, occupancyRate };
  }, [rooms]);

  // Parse floor number dynamically from room number (first numeric digit found)
  const getRoomFloor = (roomNumber: string) => {
    const match = roomNumber.match(/\d/);
    return match ? match[0] : '1';
  };

  const getRoomSize = (roomNumber: string) => {
    const num = parseInt(roomNumber.replace(/\D/g, '')) || 0;
    if (num % 3 === 0) return '18m²';
    if (num % 3 === 1) return '20m²';
    return '22m²';
  };

  const floors = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach(r => {
      set.add(getRoomFloor(r.room_number));
    });
    return Array.from(set).sort();
  }, [rooms]);

  const filteredAndSortedRooms = useMemo(() => {
    let result = rooms;

    if (activeTab === 'available') result = result.filter(r => r.status === 'available');
    else if (activeTab === 'occupied') result = result.filter(r => r.status === 'occupied');

    if (filterFloor !== 'all') {
      result = result.filter(r => getRoomFloor(r.room_number) === filterFloor);
    }

    if (filterType !== 'all') {
      result = result.filter(r => r.type === filterType);
    }

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
  }, [rooms, activeTab, filterFloor, filterType, searchQuery, sortBy]);

  const handleExportRooms = () => {
    if (!filteredAndSortedRooms || filteredAndSortedRooms.length === 0) return;

    const escapeCsvCell = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headers = [
      'No.',
      'Nomor Kamar',
      'Tipe Kamar',
      'Lantai',
      'Harga per Bulan',
      'Status Kamar',
      'Nama Penghuni',
      'Email Penghuni',
      'No. Telepon'
    ];

    const rows = filteredAndSortedRooms.map((room: Room, index: number) => {
      const tenant = getTenantForRoom(room.id);
      const tenantName = tenant ? tenant.name || '-' : '-';
      const tenantEmail = tenant ? tenant.email || '-' : '-';
      const tenantPhone = tenant ? tenant.phone || '-' : '-';
      const statusLabel = room.status === 'occupied' ? 'Terisi' 
                        : room.status === 'available' ? 'Tersedia' 
                        : room.status === 'maintenance' ? 'Perbaikan' 
                        : room.status;
      const priceFormatted = room.price_per_month 
        ? `Rp ${room.price_per_month.toLocaleString('id-ID')}` 
        : 'Rp 0';
      const floorLabel = room.floor ? `Lantai ${room.floor}` : `Lantai ${getRoomFloor(room.room_number)}`;

      return [
        index + 1,
        room.room_number || '-',
        room.type || 'Standard',
        floorLabel,
        priceFormatted,
        statusLabel,
        tenantName,
        tenantEmail,
        tenantPhone
      ];
    });

    const csvLines = [
      headers.map(escapeCsvCell).join(';'),
      ...rows.map(row => row.map(escapeCsvCell).join(';'))
    ];

    const csvContent = '\uFEFFsep=;\r\n' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `data-kamar-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = Math.ceil(filteredAndSortedRooms.length / itemsPerPage);
  const paginatedRooms = useMemo(() => {
    return filteredAndSortedRooms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredAndSortedRooms, currentPage, itemsPerPage]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatStartDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return '0 hari';
    const endDate = new Date(endDateStr);
    const now = new Date();
    now.setHours(0,0,0,0);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? `${diffDays} hari` : '0 hari';
  };

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
        status: room.status,
        type: room.type || '',
        floor: room.floor || ''
      });
      setFacilities(room.description ? room.description.split(',').map(s => s.trim()).filter(Boolean) : []);
    } else {
      setEditingRoom(null);
      setFormData({
        room_number: '',
        price_per_month: '',
        description: '',
        status: 'available',
        type: '',
        floor: ''
      });
      setFacilities([]);
    }
    setIsModalOpen(true);
  };

  const handleAssignTenant = (room: Room) => {
    router.push(`/rooms/add?roomId=${room.id}`);
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

      const url = editingRoom 
        ? `/api/rooms/${editingRoom.id}/assign-tenant`
        : '/api/rooms/with-tenant';

      await apiFetch(url, {
        method: 'POST',
        body: data
      });

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
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full animate-slide-up -mt-4 lg:-mt-8">
      {/* HEADER */}
      <div className="shrink-0 mb-3">
        <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Manajemen Kamar</h1>
        <p className="text-[15px] text-gray-500 mt-1">Kelola data kamar, status, dan penghuni kos Anda.</p>
      </div>

      {/* TABS (Pills) */}
      <div className="flex flex-wrap items-center gap-3 mt-2 mb-6 shrink-0">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'all' 
              ? 'border-emerald-200 bg-emerald-50/50 text-[#0e8a7a]' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <CheckSquare className={`w-4 h-4 ${activeTab === 'all' ? 'text-[#0e8a7a]' : 'text-emerald-500'}`} /> Semua 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'all' ? 'bg-emerald-100/50 text-[#0e8a7a]' : 'bg-gray-100 text-gray-600'}`}>{stats.total}</span>
        </button>
        
        <button
          onClick={() => setActiveTab('occupied')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'occupied' 
              ? 'border-emerald-200 bg-emerald-50/50 text-[#0e8a7a]' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${activeTab === 'occupied' ? 'text-[#0e8a7a]' : 'text-emerald-500'}`} /> Terisi 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'occupied' ? 'bg-emerald-100/50 text-[#0e8a7a]' : 'bg-gray-100 text-gray-600'}`}>{stats.occupied}</span>
        </button>

        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'available' 
              ? 'border-red-200 bg-red-50 text-red-600' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <DoorOpen className={`w-4 h-4 ${activeTab === 'available' ? 'text-red-600' : 'text-red-500'}`} /> Kosong 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'available' ? 'bg-red-100/50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{stats.available}</span>
        </button>

        <div className="px-4 py-2 bg-white border border-gray-200 rounded-[10px] text-[13px] font-bold text-[#1f2937] flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-400" /> Hunian {stats.occupancyRate}%
        </div>
      </div>

      {/* MAIN WHITE CARD CONTAINER */}
      <div className="flex-1 bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {/* TOOLBAR */}
        <div className="shrink-0 flex flex-col xl:flex-row items-center justify-between gap-4 p-6 lg:px-8 border-b border-gray-100">
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Cari nomor kamar..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-9 pr-4 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors"
              />
            </div>

            {/* Floor Dropdown */}
            <div className="relative w-full sm:w-[150px]">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Lantai</label>
              <select 
                value={filterFloor}
                onChange={(e) => setFilterFloor(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
              >
                <option value="all">Semua Lantai</option>
                {floors.map(f => (
                  <option key={f} value={f}>Lantai {f}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Room Type Dropdown */}
            <div className="relative w-full sm:w-[150px]">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Tipe Kamar</label>
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
              >
                <option value="all">Semua Tipe</option>
                <option value="Standar">Standar</option>
                <option value="VIP">VIP</option>
                <option value="VVIP">VVIP</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Sort Dropdown */}
            <div className="relative w-full sm:w-[180px]">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Urutkan</label>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
              >
                <option value="number_asc">Nomor Kamar (A-Z)</option>
                <option value="number_desc">Nomor Kamar (Z-A)</option>
                <option value="price_asc">Harga Terendah</option>
                <option value="price_desc">Harga Tertinggi</option>
              </select>
              <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end">
            {/* View Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl mr-1 shrink-0">
              <button 
                type="button"
                onClick={() => setViewMode('grid')} 
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('list')} 
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportRooms}
              className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-200 text-[#1f2937] font-bold text-[13px] rounded-[10px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm bg-white"
            >
              <Download className="w-4 h-4" /> Export Data
            </button>
            {canWriteRooms && (
              <button
                type="button"
                onClick={() => router.push('/rooms/add')}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0e8a7a] text-white font-bold text-[13px] rounded-[10px] hover:bg-[#0c7567] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Tambah Kamar
              </button>
            )}
          </div>
        </div>

        {/* CONTENT VIEW */}
        <div className={`flex-1 overflow-y-auto no-scrollbar px-6 lg:px-8 pb-6 ${
          paginatedRooms.length > 0 && viewMode === 'list' ? 'bg-slate-50 pt-0' : 'bg-white pt-6'
        }`}>
          {isLoading && rooms.length === 0 ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="w-10 h-10 animate-spin text-brand-teal" /></div>
          ) : paginatedRooms.length === 0 ? (
            <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[20px] p-12 text-center bg-white">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"><DoorOpen className="w-8 h-8" /></div>
              <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada kamar</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Data kamar tidak ditemukan berdasarkan pencarian atau filter yang Anda pilih.</p>
            </div>
          ) : viewMode === 'grid' ? (
            // GRID VIEW
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {paginatedRooms.map(room => {
                const tenant = getTenantForRoom(room.id);
                const isOccupied = room.status === 'occupied';
                return (
                  <div 
                    key={room.id} 
                    className="bg-white border border-gray-200 rounded-[16px] shadow-sm flex flex-col relative animate-in fade-in duration-200"
                  >
                    <div className="p-5 flex flex-col flex-1">
                      {/* Header Card */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                            <DoorOpen className="w-5 h-5 text-[#0e8a7a]" />
                          </div>
                          <div>
                            <h3 className="font-bold text-[#1f2937] text-[15px]">Kamar {room.room_number} {room.type && <span className="font-medium text-[11px] text-gray-400">· {room.type}</span>}</h3>
                            <p className="text-[12px] text-gray-500">Lantai {room.floor || getRoomFloor(room.room_number)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            isOccupied ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-500'
                          }`}>
                            {isOccupied ? 'Terisi' : 'Kosong'}
                          </span>
                          {canWriteRooms && <div className="relative">
                            <button 
                              onClick={(e) => { e.stopPropagation(); setActiveMenuRoomId(activeMenuRoomId === room.id ? null : room.id); }}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            {/* Dropdown Menu */}
                            {activeMenuRoomId === room.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActiveMenuRoomId(null); }} />
                                <div className="absolute right-0 top-6 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 w-28 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleOpenModal(room); setActiveMenuRoomId(null); }}
                                    className="w-full px-4 py-2 text-xs font-bold text-gray-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(room); setActiveMenuRoomId(null); }}
                                    className="w-full px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Hapus
                                  </button>
                                </div>
                              </>
                            )}
                          </div>}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="flex items-center gap-2 text-[13px] text-[#1f2937] font-bold mb-6">
                        <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center">
                          <Wallet className="w-3 h-3 text-emerald-600" />
                        </div>
                        <span>Rp {room.price_per_month.toLocaleString('id-ID')} <span className="font-medium text-gray-500">/ bulan</span></span>
                      </div>

                      {/* Separator */}
                      <div className="h-px bg-gray-100 w-full mb-5"></div>

                      {/* Tenant or Empty State */}
                      {isOccupied && tenant ? (
                        <div className="flex flex-col flex-1 justify-between gap-5 h-[130px]">
                          <div className="flex gap-3 items-center">
                            <div className="w-10 h-10 rounded-full bg-[#0e8a7a] text-white flex items-center justify-center font-bold text-[13px] shrink-0 overflow-hidden">
                              {tenant.selfie_url ? (
                                <img src={getImageUrl(tenant.selfie_url)} alt={tenant.name} className="w-full h-full object-cover" />
                              ) : (
                                tenant.name?.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#1f2937] text-[14px] leading-tight mb-0.5 truncate">{tenant.name}</p>
                              <p className="text-[12px] text-gray-500 truncate">{tenant.phone}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-[12px] text-gray-500 mb-2">
                            <Calendar className="w-4 h-4" />
                            <span>Berakhir {formatStartDate(tenant.contract?.end_date)}</span>
                          </div>

                          <button onClick={() => router.push(`/tenants/${tenant.id}`)} className="w-full py-2.5 border border-emerald-500 text-emerald-600 rounded-[10px] text-[13px] font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2 mt-auto">
                            <ExternalLink className="w-4 h-4" /> Detail Penghuni
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col flex-1 justify-between gap-4 h-[130px]">
                          <div className="flex flex-col items-center justify-center text-center flex-1">
                            <div className="w-10 h-10 bg-blue-50/50 rounded-full flex items-center justify-center mb-2">
                              <Armchair className="w-5 h-5 text-blue-300" />
                            </div>
                            <p className="font-bold text-[#1f2937] text-[13px] mb-0.5">Kamar tersedia</p>
                            <p className="text-[11px] text-gray-500 leading-tight px-4">Siap untuk diisi penghuni baru</p>
                          </div>

                          {canWriteRooms && (
                            <button onClick={() => handleAssignTenant(room)} className="w-full py-2.5 bg-[#0e8a7a] hover:bg-[#0c7567] text-white rounded-[10px] text-[13px] font-bold transition-colors flex items-center justify-center gap-2 mt-auto shadow-sm">
                              <Plus className="w-4 h-4" /> Tambah Penghuni
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // LIST VIEW
            <table className="w-full text-left text-sm border-separate border-spacing-y-4 min-w-[900px]">
              <thead className="sticky top-0 bg-slate-50 z-20">
                <tr className="text-[13px] font-bold text-gray-500 tracking-wide">
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Unit Kamar</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Status</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Penghuni</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Harga/Bulan</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRooms.map(room => {
                  const tenant = getTenantForRoom(room.id);
                  const isOccupied = room.status === 'occupied';
                  return (
                    <tr key={room.id} className="bg-white group relative">
                      <td 
                        className="px-6 py-5 rounded-l-[16px] border-y border-l border-gray-200 align-middle bg-white"
                      >
                        <div>
                          <p className="font-bold text-brand-navy text-[15px]">Kamar {room.room_number} {room.type && <span className="font-medium text-[11px] text-gray-400">· {room.type}</span>}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">Lantai {room.floor || getRoomFloor(room.room_number)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isOccupied ? 'bg-teal-50 text-[#0e8a7a]' : 'bg-amber-50 text-[#f59e0b]'
                        }`}>
                          {isOccupied ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#0e8a7a] inline-block" />
                              Terisi
                            </>
                          ) : (
                            'Kosong'
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white">
                        {isOccupied && tenant ? (
                          <div 
                            onClick={() => router.push(`/tenants/${tenant.id}`)}
                            className="flex items-center gap-2.5 cursor-pointer group/name"
                          >
                            <div className="w-9 h-9 rounded-full bg-brand-teal text-white overflow-hidden flex items-center justify-center shrink-0 shadow-sm text-[11px] font-bold">
                              {tenant.selfie_url ? (
                                <img src={getImageUrl(tenant.selfie_url)} alt={tenant.name} className="w-full h-full object-cover" />
                              ) : (
                                tenant.name?.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-sm text-brand-navy group-hover/name:text-[#0e8a7a] transition-colors">{tenant.name}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{tenant.phone} · Mulai: {formatStartDate(tenant.contract?.start_date)} · Sisa: {getDaysRemaining(tenant.contract?.end_date)}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[13px] text-gray-400 font-medium">Belum ada penghuni</span>
                        )}
                      </td>
                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white font-bold text-brand-navy text-[14px]">
                        Rp {room.price_per_month.toLocaleString('id-ID')} /bln
                      </td>
                      <td className="px-6 py-5 rounded-r-[16px] border-y border-r border-gray-200 align-middle bg-white text-right">
                        <div className="flex items-center justify-end gap-2.5 relative">
                          {isOccupied && tenant ? (
                            <button 
                              onClick={() => router.push(`/tenants/${tenant.id}`)}
                              className="px-3.5 py-2 text-[11px] font-bold text-emerald-600 border border-emerald-500 hover:bg-emerald-50 rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer animate-in fade-in duration-200 shadow-sm bg-white"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Detail Penghuni
                            </button>
                          ) : canWriteRooms ? (
                            <button 
                              onClick={() => handleAssignTenant(room)}
                              className="px-3.5 py-2 text-[11px] font-bold text-white bg-[#0e8a7a] hover:bg-[#0c7567] rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer shadow-sm"
                            >
                              <Plus className="w-3.5 h-3.5" /> Tambah Penghuni
                            </button>
                          ) : null}
                          {canWriteRooms && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveMenuRoomId(activeMenuRoomId === room.id ? null : room.id); }}
                                className="p-2 text-gray-400 hover:text-brand-navy rounded-xl transition-colors cursor-pointer hover:bg-gray-50"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuRoomId === room.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActiveMenuRoomId(null); }} />
                                  <div className="absolute right-0 top-10 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 w-28 text-left animate-in fade-in slide-in-from-top-2 duration-200">
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(room); setActiveMenuRoomId(null); }} className="w-full px-4 py-2 text-xs font-bold text-gray-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5" /> Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(room); setActiveMenuRoomId(null); }} className="w-full px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /> Hapus</button>
                                  </div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        <div className="shrink-0 p-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-6">
            <div className="text-[14px] text-gray-500 font-medium">
              Menampilkan {filteredAndSortedRooms.length > 0 ? Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedRooms.length) : 0} - {Math.min(currentPage * itemsPerPage, filteredAndSortedRooms.length)} dari {filteredAndSortedRooms.length} kamar
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[14px] text-gray-500">Tampilkan:</span>
              <select
                value={itemsPerPage}
                onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none bg-white text-brand-navy font-bold cursor-pointer shadow-sm text-sm"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || filteredAndSortedRooms.length === 0}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors bg-white"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            {Array.from({ length: Math.max(1, totalPages) }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-xl text-[14px] font-bold transition-colors ${currentPage === i + 1
                  ? 'bg-[#0e8a7a] text-white border border-[#0e8a7a]'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || filteredAndSortedRooms.length === 0}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

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
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Tipe Kamar <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm cursor-pointer"
                      >
                        <option value="" disabled>Silahkan pilih...</option>
                        <option value="Standar">Standar</option>
                        <option value="VIP">VIP</option>
                        <option value="VVIP">VVIP</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-brand-navy">Lantai Ke- <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={formData.floor}
                        onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                        className="w-full bg-white border-[1.5px] border-gray-300 rounded-[9px] py-2.5 px-3.5 text-brand-navy font-semibold text-xs focus:outline-none focus:border-brand-teal focus:ring-4 focus:ring-brand-teal/10 transition-all shadow-sm cursor-pointer"
                      >
                        <option value="" disabled>Silahkan pilih...</option>
                        {[1, 2, 3, 4, 5].map(num => (
                          <option key={num} value={num.toString()}>Lantai {num}</option>
                        ))}
                      </select>
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

                <div className="border-t border-gray-200 dark:border-slate-800 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium"><span className="text-red-500">*</span> Field wajib diisi</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border-[1.5px] border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 text-brand-navy dark:text-slate-300 font-bold rounded-[9px] transition-all text-xs bg-white dark:bg-slate-800 shadow-sm"
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
                          <label htmlFor="ktp-upload-room" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] cursor-pointer transition-all shadow-sm overflow-hidden min-h-[120px] ${files.ktp ? 'border-brand-teal' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white p-3.5'}`}>
                            {files.ktp ? (
                              <img src={URL.createObjectURL(files.ktp)} alt="KTP Preview" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <>
                                <div className="text-2xl mb-1">🪪</div>
                                <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">Dokumen KTP <span className="text-red-500">*</span></p>
                                <p className="text-[9px] text-gray-500 font-medium text-center">Klik untuk pilih foto</p>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="relative">
                          <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'selfie')} className="hidden" id="selfie-upload-room" />
                          <label htmlFor="selfie-upload-room" className={`relative flex flex-col items-center justify-center border-[1.5px] rounded-[9px] cursor-pointer transition-all shadow-sm overflow-hidden min-h-[120px] ${files.selfie ? 'border-brand-teal' : 'border-dashed border-gray-300 hover:border-brand-teal bg-white p-3.5'}`}>
                            {files.selfie ? (
                              <img src={URL.createObjectURL(files.selfie)} alt="Selfie Preview" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <>
                                <div className="text-2xl mb-1">🤳</div>
                                <p className="text-xs font-bold text-brand-navy mb-0.5 text-center">Foto Selfie <span className="text-red-500">*</span></p>
                                <p className="text-[9px] text-gray-500 font-medium text-center">Klik untuk pilih foto</p>
                              </>
                            )}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-slate-800 px-8 py-4 -mx-8 mb-0 rounded-b-[32px] flex items-center justify-between mt-4 shrink-0">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium"><span className="text-red-500">*</span> Field wajib diisi</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-2 border-[1.5px] border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 text-brand-navy dark:text-slate-300 font-bold rounded-[9px] transition-all text-xs bg-white dark:bg-slate-800 shadow-sm"
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
