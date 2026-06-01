'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { 
  FileText, CheckCircle2, Clock, AlertTriangle, 
  Search, Plus, LayoutGrid, List as ListIcon, 
  MoreVertical, FileSignature, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Contract {
  id: string;
  room_id: string;
  tenant_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit: number;
  payment_due_day: number;
  status: string;
  created_at: string;
  room?: {
    id: string;
    room_number: string;
    price_per_month: number;
    status: string;
  };
  tenant?: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function ContractsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'end_date_asc' | 'end_date_desc'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchContracts = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/contracts');
      setContracts(data || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchContracts();
  }, []);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter(c => c.status === 'active').length;
    const expired = contracts.filter(c => c.status === 'expired').length;
    
    // Calculate ending soon (within 30 days)
    const now = new Date();
    const endingSoon = contracts.filter(c => {
      if (c.status !== 'active') return false;
      const end = new Date(c.end_date);
      const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays > 0;
    }).length;

    return { total, active, expired, endingSoon };
  }, [contracts]);

  const filteredAndSortedContracts = useMemo(() => {
    let result = [...contracts];

    // Status Filter
    if (activeTab !== 'all') {
      result = result.filter(c => c.status === activeTab);
    }

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        (c.room?.room_number?.toLowerCase().includes(query) || false) ||
        (c.tenant?.name?.toLowerCase().includes(query) || false)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'end_date_asc') {
        return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      } else if (sortBy === 'end_date_desc') {
        return new Date(b.end_date).getTime() - new Date(a.end_date).getTime();
      }
      return 0;
    });

    return result;
  }, [contracts, activeTab, searchQuery, sortBy]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6 animate-slide-up pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-extrabold text-brand-navy/50 uppercase tracking-widest mb-1">DATA KONTRAK</p>
          <h1 className="text-3xl font-display font-bold text-brand-navy">Manajemen Kontrak</h1>
          <p className="text-sm text-gray-500 mt-1">Kelola data perjanjian sewa antara penghuni dan kamar</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/contracts/new"
            className="px-4 py-2 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center gap-2 shadow-sm group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Tambah Kontrak
          </Link>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-200 group-hover:bg-brand-navy transition-colors duration-300"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-brand-navy group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><FileText className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">Total</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">TOTAL KONTRAK</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.total}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-3">Seluruh riwayat sewa</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-200 group-hover:bg-brand-teal transition-colors duration-300"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-brand-teal/10 rounded-xl flex items-center justify-center text-brand-teal group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><CheckCircle2 className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-brand-teal bg-brand-teal/10 px-2.5 py-0.5 rounded-full">Berjalan</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">KONTRAK AKTIF</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.active}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-3">Sedang berjalan saat ini</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-200 group-hover:bg-amber-500 transition-colors duration-300"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><Clock className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">&lt; 30 Hari</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">AKAN BERAKHIR</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.endingSoon}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-3">Kurang dari 30 hari lagi</p>
        </div>

        <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 group relative overflow-hidden">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gray-200 group-hover:bg-red-500 transition-colors duration-300"></div>
          
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300"><AlertTriangle className="w-5 h-5" /></div>
            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">Selesai</span>
          </div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">EXPIRED</p>
          <p className="text-3xl font-display font-bold text-brand-navy">{stats.expired}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-3">Telah habis masa sewa</p>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="flex flex-col lg:flex-row items-center gap-4 py-2">
        <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'all', label: `Semua (${stats.total})` },
            { id: 'active', label: 'Aktif' },
            { id: 'expired', label: 'Expired' }
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
              placeholder="Cari kamar atau penghuni..." 
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
            <option value="newest">Terbaru</option>
            <option value="end_date_asc">Habis Terdekat</option>
            <option value="end_date_desc">Habis Terlama</option>
          </select>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
          <span className="text-xs text-gray-500 font-medium">Menampilkan <b>{filteredAndSortedContracts.length}</b> kontrak</span>
          <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-400 hover:text-brand-navy'}`}><ListIcon className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* CONTENT VIEW */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-brand-teal border-t-transparent rounded-full animate-spin"></div></div>
      ) : filteredAndSortedContracts.length === 0 ? (
        <div className="bg-white border-[1.5px] border-gray-200 border-dashed rounded-[24px] p-12 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400"><FileSignature className="w-8 h-8" /></div>
          <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada kontrak</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">Data kontrak sewa tidak ditemukan berdasarkan pencarian atau filter yang Anda pilih.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedContracts.map(contract => {
            // Calculate contract progress
            const startDate = new Date(contract.start_date);
            const endDate = new Date(contract.end_date);
            const today = new Date();
            const totalDays = Math.max((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24), 1);
            const elapsedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
            const progressPercent = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
            const remainingDays = Math.max(Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 0);
            const progressColor = contract.status !== 'active' ? '#9ca3af' : remainingDays > 60 ? '#0e8a7a' : remainingDays > 30 ? '#d97706' : '#dc2626';

            return (
            <div key={contract.id} className="bg-white border-[1.5px] border-gray-200 rounded-[20px] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative group">
              <div className="p-5 flex-1">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Kamar {contract.room?.room_number || '-'} · Lantai {(contract.room?.room_number || '1')[0]}</p>
                    <h3 className="text-lg font-bold text-brand-navy line-clamp-1">{contract.tenant?.name || '-'}</h3>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                    contract.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${contract.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {contract.status === 'active' ? 'Aktif' : 'Berakhir'}
                  </span>
                </div>
                
                {/* Timeline Row */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="shrink-0">
                    <p className="text-[9px] text-gray-400 font-medium">Mulai</p>
                    <p className="text-xs font-bold text-brand-navy">{formatDate(contract.start_date)}</p>
                  </div>
                  <div className="flex-1 px-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] text-gray-400">→</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400">→</span>
                    </div>
                    <p className="text-[9px] text-gray-400 text-center font-medium">Progress {progressPercent}%</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[9px] text-gray-400 font-medium">Berakhir</p>
                    <p className="text-xs font-bold text-brand-navy">{formatDate(contract.end_date)}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/50 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-gray-400 font-medium">Jatuh tempo tgl <span className="font-bold text-brand-navy">{contract.payment_due_day}</span> setiap bulan</p>
                  <p className="text-xs font-bold text-brand-teal mt-0.5">Rp {contract.monthly_rent?.toLocaleString('id-ID')}<span className="text-[9px] text-gray-400 font-normal">/bln</span></p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-[9px] text-gray-400 font-medium">Sisa</p>
                    <p className={`text-sm font-bold ${remainingDays <= 30 ? 'text-red-600' : remainingDays <= 60 ? 'text-amber-600' : 'text-teal-600'}`}>
                      {remainingDays} hari
                    </p>
                  </div>
                  <Link href={`/contracts/${contract.id}`} className="p-2 bg-white rounded-lg border border-gray-200 text-brand-navy hover:text-brand-teal hover:border-brand-teal transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Penyewa & Kamar</th>
                  <th className="px-6 py-4">Periode & Progress</th>
                  <th className="px-6 py-4">Tarif & Jatuh Tempo</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedContracts.map(contract => {
                  const startDate = new Date(contract.start_date);
                  const endDate = new Date(contract.end_date);
                  const today = new Date();
                  const totalDays = Math.max((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24), 1);
                  const elapsedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
                  const progressPercent = Math.min(Math.max(Math.round((elapsedDays / totalDays) * 100), 0), 100);
                  const remainingDays = Math.max(Math.round((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 0);
                  const progressColor = contract.status !== 'active' ? '#9ca3af' : remainingDays > 60 ? '#0e8a7a' : remainingDays > 30 ? '#d97706' : '#dc2626';

                  return (
                  <tr key={contract.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-brand-navy">{contract.tenant?.name || '-'}</p>
                      <p className="text-[10px] font-bold text-brand-teal mt-0.5">Kamar {contract.room?.room_number || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                        <span>{formatDate(contract.start_date)}</span>
                        <span>{formatDate(contract.end_date)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all"
                          style={{ width: `${progressPercent}%`, backgroundColor: progressColor }}
                        />
                      </div>
                      <p className={`text-[9px] font-bold mt-1 text-right ${remainingDays <= 30 ? 'text-red-600' : remainingDays <= 60 ? 'text-amber-600' : 'text-teal-600'}`}>
                        Sisa {remainingDays} hari
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-brand-navy">{formatCurrency(contract.monthly_rent)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Jatuh tempo tgl {contract.payment_due_day}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        contract.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-1 ring-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${contract.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {contract.status === 'active' ? 'Aktif' : 'Berakhir'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/contracts/${contract.id}`} 
                        className="px-3 py-1.5 text-xs font-bold text-brand-teal bg-brand-teal/10 hover:bg-brand-teal/20 rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        Detail Kontrak <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
