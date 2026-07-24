'use client';

import { useState, useEffect, useMemo } from 'react';
import { apiFetch, getImageUrl } from '@/lib/api';
import {
  Users, CheckCircle2, Clock, AlertTriangle,
  Search, CheckSquare, FileWarning, AlertCircle, FileQuestion,
  ChevronRight, ChevronLeft, Download, ArrowUpDown, ChevronDown,
  LayoutGrid, List as ListIcon
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email?: string;
  room_id: string;
  ktp_url: string;
  selfie_url: string;
  contract_id?: string;
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

export default function TenantsPage() {
  const router = useRouter();
  const { can } = useAuthorization();
  const [mounted, setMounted] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expiring' | 'unpaid' | 'missingDocs'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'name_asc' | 'closest_expiry'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const contractsData = await apiFetch('/api/contracts');
      const mappedTenants = (contractsData || []).map((c: any) => ({
        id: c.user?.id || '',
        name: c.user?.name || 'Unknown',
        phone: c.user?.phone || '-',
        email: c.user?.email || (c.user?.name ? `${c.user.name.toLowerCase().replace(/\s/g, '')}@gmail.com` : '-'),
        room_id: c.room_id,
        ktp_url: c.user?.ktp_url,
        selfie_url: c.user?.selfie_url,
        contract_id: c.id,
        contract: {
          start_date: c.start_date,
          end_date: c.end_date,
          rental_duration: c.rental_duration,
          status: c.status,
          latest_payment_status: c.latest_payment_status,
          latest_payment_amount: c.latest_payment_amount
        },
        created_at: c.created_at,
        room: c.room
      }));
      setTenants(mappedTenants);
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
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getMonthsAgo = (dateStr?: string) => {
    if (!dateStr) return 0;
    const past = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - past.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30));
  };

  const getPaymentStatusLabel = (status: string | null) => {
    if (!status) return 'Lunas';
    switch (status) {
      case 'paid': return 'Lunas';
      case 'pending': return 'Menunggu Verifikasi';
      case 'partial': return 'Bayar Sebagian';
      case 'overdue': return 'Terlambat';
      case 'unpaid': return 'Belum Bayar';
      default: return 'Belum Bayar';
    }
  };

  // Enhance Tenants Data with Calculations
  const enhancedTenants = useMemo(() => {
    return tenants.map(t => {
      const entryDate = new Date(t.contract?.start_date || t.created_at);
      const endDate = new Date(t.contract?.end_date || t.created_at);

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const timeDiff = endDate.getTime() - now.getTime();
      const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      let contractStatus = 'Aktif';
      let statusColorDot = 'bg-emerald-500';
      let statusPillColor = 'bg-emerald-50 text-emerald-600';

      if (daysUntilExpiry < 0) {
        contractStatus = 'Kadaluarsa';
        statusColorDot = 'bg-red-500';
        statusPillColor = 'bg-red-50 text-red-600';
      } else if (daysUntilExpiry <= 30) {
        contractStatus = 'Segera Habis';
        statusColorDot = 'bg-amber-500';
        statusPillColor = 'bg-amber-50 text-amber-600';
      }

      const paymentStatus = getPaymentStatusLabel(t.contract?.latest_payment_status || null);
      let paymentPillColor = 'bg-emerald-50 text-emerald-600';
      let paymentIcon = <CheckCircle2 className="w-3 h-3 text-emerald-500" />;

      if (paymentStatus === 'Belum Bayar' || paymentStatus === 'Terlambat') {
        paymentPillColor = 'bg-red-50 text-red-600';
        paymentIcon = <AlertCircle className="w-3 h-3 text-red-500" />;
      } else if (paymentStatus === 'Menunggu Verifikasi' || paymentStatus === 'Bayar Sebagian') {
        paymentPillColor = 'bg-amber-50 text-amber-600';
        paymentIcon = <Clock className="w-3 h-3 text-amber-500" />;
      }

      const isMissingDocs = !t.ktp_url || !t.selfie_url;

      // Extract floor from room number (e.g. "A-999" -> "Lantai A", "101" -> "Lantai 1")
      const firstChar = t.room?.room_number?.charAt(0) || '';
      const floorStr = isNaN(Number(firstChar)) ? `Lantai ${firstChar}` : `Lantai ${firstChar}`;

      return {
        ...t,
        endDate,
        daysUntilExpiry,
        contractStatus,
        statusColorDot,
        statusPillColor,
        paymentStatus,
        paymentPillColor,
        paymentIcon,
        isMissingDocs,
        floorStr,
        monthsAgo: getMonthsAgo(t.contract?.start_date)
      };
    });
  }, [tenants]);

  // Statistics
  const stats = useMemo(() => {
    return {
      all: enhancedTenants.length,
      active: enhancedTenants.filter(t => t.daysUntilExpiry >= 0).length,
      expiring: enhancedTenants.filter(t => t.daysUntilExpiry >= 0 && t.daysUntilExpiry <= 30).length,
      unpaid: enhancedTenants.filter(t => t.paymentStatus === 'Belum Bayar' || t.paymentStatus === 'Terlambat').length,
      missingDocs: enhancedTenants.filter(t => t.isMissingDocs).length,
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
    } else if (activeTab === 'missingDocs') {
      result = result.filter(t => t.isMissingDocs);
    }

    // Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.room?.room_number.toLowerCase().includes(q) ||
        t.phone.includes(q)
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

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortBy, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedTenants.length / itemsPerPage);
  const paginatedTenants = filteredAndSortedTenants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full animate-slide-up -mt-4 lg:-mt-8">

      {/* HEADER */}
      <div className="shrink-0 mb-3 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-[28px] font-display font-extrabold text-brand-navy">Penghuni & Kontrak</h1>
        <p className="text-[15px] text-gray-500 mt-1">Kelola data penghuni dan kontrak kamar kos Anda.</p></div>
        {can(CAPABILITIES.TENANT_WRITE) && <button onClick={() => router.push('/tenants/invitations')} className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white">Undang calon penghuni</button>}
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
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'all' ? 'bg-emerald-100/50 text-[#0e8a7a]' : 'bg-gray-100 text-gray-600'}`}>{stats.all}</span>
        </button>

        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'active' 
              ? 'border-emerald-200 bg-emerald-50/50 text-[#0e8a7a]' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <CheckCircle2 className={`w-4 h-4 ${activeTab === 'active' ? 'text-emerald-500' : 'text-emerald-500'}`} /> Aktif 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'active' ? 'bg-emerald-100/50 text-[#0e8a7a]' : 'bg-gray-100 text-gray-600'}`}>{stats.active}</span>
        </button>

        <button
          onClick={() => setActiveTab('expiring')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'expiring' 
              ? 'border-amber-200 bg-amber-50 text-amber-600' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <Clock className={`w-4 h-4 ${activeTab === 'expiring' ? 'text-amber-500' : 'text-amber-500'}`} /> Segera Habis 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'expiring' ? 'bg-amber-100/50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>{stats.expiring}</span>
        </button>

        <button
          onClick={() => setActiveTab('unpaid')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'unpaid' 
              ? 'border-red-200 bg-red-50 text-red-600' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <FileWarning className={`w-4 h-4 ${activeTab === 'unpaid' ? 'text-red-500' : 'text-red-500'}`} /> Belum Bayar 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'unpaid' ? 'bg-red-100/50 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{stats.unpaid}</span>
        </button>

        <button
          onClick={() => setActiveTab('missingDocs')}
          className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
            activeTab === 'missingDocs' 
              ? 'border-amber-200 bg-amber-50 text-amber-600' 
              : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
          }`}
        >
          <FileQuestion className={`w-4 h-4 ${activeTab === 'missingDocs' ? 'text-amber-500' : 'text-amber-500'}`} /> Dokumen Kurang 
          <span className={`px-2 py-0.5 rounded-md ${activeTab === 'missingDocs' ? 'bg-amber-100/50 text-amber-600' : 'bg-gray-100 text-gray-600'}`}>{stats.missingDocs}</span>
        </button>
      </div>

      {/* MAIN WHITE CARD */}
      <div className="flex-1 bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col overflow-hidden">

        {/* TOOLBAR (Head) */}
        <div className="shrink-0 flex flex-col lg:flex-row items-center justify-between gap-4 p-6 lg:px-8 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-[280px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cari nama / kamar / no. HP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-9 pr-4 py-2.5 text-[13px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors shadow-sm"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative w-full sm:w-[200px]">
              <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Urutkan</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-brand-navy focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
              >
                <option value="newest">Terbaru</option>
                <option value="name_asc">Nama A-Z</option>
                <option value="closest_expiry">Terdekat</option>
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

            <button className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-200 text-brand-navy font-bold text-[13px] rounded-[10px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm bg-white">
              <Download className="w-4 h-4" /> Export Data
            </button>
          </div>
        </div>

        {/* TABLE BODY CONTAINER */}
        <div className={`flex-1 overflow-y-auto no-scrollbar px-6 lg:px-8 pb-6 ${
          paginatedTenants.length > 0 && viewMode === 'list' ? 'bg-slate-50 pt-0' : 'bg-white pt-6'
        }`}>
          {isLoading && tenants.length === 0 ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="w-10 h-10 border-4 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin"></div>
            </div>
          ) : paginatedTenants.length === 0 ? (
            <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[20px] p-12 text-center bg-white">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"><Users className="w-8 h-8" /></div>
              <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada penghuni</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Data penghuni tidak ditemukan berdasarkan pencarian atau filter yang Anda pilih.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-4">
              {paginatedTenants.map(t => (
                <div key={t.id} className="bg-white border-[1.5px] border-gray-200 rounded-[20px] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative group">
                  {/* Top Accent Color Bar */}
                  <div className={`absolute top-0 left-0 w-full h-[3px] ${
                    t.daysUntilExpiry < 0 ? 'bg-red-500' : t.daysUntilExpiry <= 30 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}></div>
                  
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    {/* Profile Header */}
                    <div className="flex items-start gap-4 mb-4">
                      <div className="relative shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                          {t.selfie_url ? (
                            <img src={getImageUrl(t.selfie_url)} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-brand-teal/10 text-brand-teal font-display font-bold text-lg">
                              {t.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className={`absolute top-0 right-0 w-3 h-3 rounded-full border-2 border-white ${t.statusColorDot}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                          <h3 className="font-bold text-brand-navy text-[15px] truncate max-w-[140px]">{t.name}</h3>
                          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${t.statusPillColor}`}>
                            {t.contractStatus}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 truncate">{t.email}</p>
                        <p className="text-[12px] text-gray-600 font-semibold mt-1">{t.phone}</p>
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full my-3"></div>

                    {/* Mid Details */}
                    <div className="grid grid-cols-2 gap-3 mb-4 text-left">
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Kamar & Lantai</p>
                        <p className="text-xs font-bold text-brand-navy mt-0.5">Kamar {t.room?.room_number}</p>
                        <p className="text-[11px] text-gray-500">{t.floorStr}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Status Bayar</p>
                        <div className="mt-0.5">
                          <span className={`inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold ${t.paymentPillColor}`}>
                            {t.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 text-left">
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Tanggal Masuk</p>
                        <p className="text-xs font-bold text-gray-600 mt-0.5">{formatDate(t.contract?.start_date)}</p>
                        <p className="text-[10px] text-gray-400">({t.monthsAgo} bln lalu)</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Akhir Kontrak</p>
                        <p className="text-xs font-bold text-gray-600 mt-0.5">{formatDate(t.contract?.end_date)}</p>
                        <p className={`text-[10px] font-bold ${t.daysUntilExpiry < 0 ? 'text-red-500' : 'text-[#0e8a7a]'}`}>
                          {t.daysUntilExpiry < 0 ? `${Math.abs(t.daysUntilExpiry)} hari lewat` : `${t.daysUntilExpiry} hari sisa`}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-gray-100 w-full my-3"></div>

                    {/* Documents & Action */}
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex gap-3 text-[11px] font-bold text-left">
                        <div className="flex items-center gap-1">
                          {t.ktp_url ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <span className={t.ktp_url ? "text-gray-500" : "text-red-500"}>KTP</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {t.selfie_url ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <span className={t.selfie_url ? "text-gray-500" : "text-red-500"}>Selfie</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => router.push(`/tenants/${t.id}`)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 hover:bg-gray-50 hover:text-brand-teal hover:border-brand-teal transition-all shadow-sm bg-white"
                      >
                        Detail Profil <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-left text-sm border-separate border-spacing-y-4 min-w-[1100px]">
              <thead className="sticky top-0 bg-slate-50 z-20">
                <tr className="text-[13px] font-bold text-gray-500 tracking-wide">
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Penghuni</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Kamar</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">No. HP</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Masuk</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Akhir Kontrak</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Sisa Hari</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Status Pembayaran</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Dokumen</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTenants.map(t => (
                  <tr key={t.id} className="bg-white group relative">
                    <td className="px-6 py-5 rounded-l-[16px] border-y border-l border-gray-200 align-top bg-white">
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                            {t.selfie_url ? (
                              <img src={getImageUrl(t.selfie_url)} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-brand-teal/10 text-brand-teal font-display font-bold text-lg">
                                {t.name.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${t.statusColorDot}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-bold text-brand-navy text-[15px]">{t.name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${t.statusPillColor}`}>
                              {t.contractStatus}
                            </span>
                          </div>
                          <span className="text-[13px] text-gray-500 block">{t.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <p className="font-bold text-brand-navy text-[14px]">Kamar {t.room?.room_number}</p>
                      <p className="text-[13px] text-gray-500 mt-0.5">{t.floorStr}</p>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <span className="text-[14px] text-gray-600 font-medium">{t.phone}</span>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <p className="text-[14px] text-gray-600 font-medium">{formatDate(t.contract?.start_date)}</p>
                      <p className="text-[13px] text-gray-400 mt-0.5">({t.monthsAgo} bulan lalu)</p>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <span className="text-[14px] text-gray-600 font-medium">{formatDate(t.contract?.end_date)}</span>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <span className={`text-[14px] font-bold ${t.daysUntilExpiry < 0 ? 'text-red-500' : t.daysUntilExpiry <= 30 ? 'text-[#0e8a7a]' : 'text-[#0e8a7a]'}`}>
                        {t.daysUntilExpiry < 0 ? `${Math.abs(t.daysUntilExpiry)} hari lewat` : `${t.daysUntilExpiry} hari`}
                      </span>
                      {t.daysUntilExpiry < 0 && (
                        <span className="block mt-1 w-fit text-[10px] px-2 py-0.5 rounded bg-red-50 text-red-600 font-bold">Segera Habis</span>
                      )}
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <span className={`inline-block px-3 py-1 rounded-lg text-[11px] font-bold ${t.paymentPillColor}`}>
                        {t.paymentStatus}
                      </span>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-500 font-medium">
                        {t.paymentIcon} Jan {new Date().getFullYear()}
                      </div>
                    </td>

                    <td className="px-6 py-5 border-y border-gray-200 align-top bg-white">
                      <div className="flex flex-col gap-2 text-[12px] font-bold">
                        <div className="flex items-center gap-1.5">
                          {t.ktp_url ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                          <span className={t.ktp_url ? "text-gray-600" : "text-red-500"}>KTP</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {t.selfie_url ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-red-500" />}
                          <span className={t.selfie_url ? "text-gray-600" : "text-red-500"}>Selfie</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5 rounded-r-[16px] border-y border-r border-gray-200 align-middle text-center bg-white">
                      <button
                        onClick={() => router.push(`/tenants/${t.id}`)}
                        className="inline-flex items-center justify-center gap-1 px-4 py-2 border border-gray-200 rounded-xl text-[12px] font-bold text-gray-700 hover:bg-gray-50 transition-colors w-full whitespace-nowrap shadow-sm"
                      >
                        Detail Profil <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION */}
        <div className="shrink-0 p-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 bg-white">
          <div className="flex items-center gap-6">
            <div className="text-[14px] text-gray-500 font-medium">
              Menampilkan {filteredAndSortedTenants.length > 0 ? Math.min((currentPage - 1) * itemsPerPage + 1, filteredAndSortedTenants.length) : 0} - {Math.min(currentPage * itemsPerPage, filteredAndSortedTenants.length)} dari {filteredAndSortedTenants.length} penghuni
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
              disabled={currentPage === 1 || filteredAndSortedTenants.length === 0}
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
              disabled={currentPage === totalPages || filteredAndSortedTenants.length === 0}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
