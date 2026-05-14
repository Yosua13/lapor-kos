'use client';

import { useState, useEffect } from 'react';
import { 
  Users, 
  DoorOpen, 
  TrendingUp, 
  Wallet,
  ArrowRight,
  Plus,
  AlertCircle,
  MoreHorizontal,
  ChevronRight,
  Activity,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [roomsData, tenantsData] = await Promise.all([
          apiFetch('/api/rooms'),
          apiFetch('/api/tenants')
        ]);
        setRooms(roomsData || []);
        setTenants(tenantsData || []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const vacantRooms = totalRooms - occupiedRooms;
  const totalTenants = tenants.length;
  
  // Calculate revenue (dummy calculation based on occupied rooms)
  const monthlyRevenue = occupiedRooms * 1.5; // Assuming 1.5jt per room avg
  const revenueTarget = 16.0;

  const stats = [
    { label: 'Total Kamar', value: totalRooms, target: totalRooms, sub: 'Semua kamar terdaftar', icon: DoorOpen, color: 'emerald' },
    { label: 'Kamar Terisi', value: occupiedRooms, target: totalRooms, sub: `${vacantRooms} kamar masih kosong`, icon: Users, color: 'brand-teal' },
    { label: 'Total Penghuni', value: totalTenants, target: totalTenants, sub: 'Aktif menghuni', icon: TrendingUp, color: 'purple' },
    { label: 'Pendapatan (Bln)', value: monthlyRevenue, target: revenueTarget, sub: `Target Rp ${revenueTarget.toFixed(1)}jt (${((monthlyRevenue/revenueTarget)*100).toFixed(0)}%)`, icon: Wallet, color: 'orange', isCurrency: true },
  ];

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-brand-navy/40">
        <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
        <p className="font-bold text-sm uppercase tracking-widest">Menyiapkan Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto animate-slide-up">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">RINGKASAN PROPERTI</p>
          <h1 className="text-4xl font-display font-bold text-brand-navy">Dashboard</h1>
          <p className="text-brand-navy/40 text-sm mt-1">Pantau status kos Anda dalam satu tampilan • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/tenants" className="bg-white hover:bg-brand-cream text-brand-navy text-sm font-bold px-6 py-3.5 rounded-2xl border border-brand-navy/10 transition-all flex items-center gap-2 shadow-sm">
             <Users className="w-4 h-4 text-brand-teal" />
             <span>Data Penghuni</span>
          </Link>
          <Link href="/rooms" className="bg-brand-teal hover:bg-brand-teal-light text-white text-sm font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-brand-teal/30 transition-all flex items-center gap-2 group">
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
            <span>Manajemen Kamar</span>
          </Link>
        </div>
      </header>

      {/* Alert Banner (Only if any rooms occupied) */}
      {occupiedRooms > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-center justify-between group cursor-pointer hover:bg-amber-100/50 transition-colors animate-slide-up [animation-delay:100ms]">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-amber-200/50 rounded-xl flex items-center justify-center text-amber-700">
                <AlertCircle className="w-5 h-5 animate-pulse" />
             </div>
             <p className="text-sm font-medium text-amber-900">
               <span className="font-bold">Sistem Penagihan Aktif</span> — Pastikan semua penghuni telah menerima invoice untuk bulan ini.
             </p>
          </div>
          <button className="text-amber-700 text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
             Lihat Pembayaran <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="glass-panel glass-panel-hover p-6 rounded-[32px] animate-slide-up"
            style={{ animationDelay: `${200 + i * 100}ms` }}
          >
            <div className="flex justify-between items-start mb-6">
               <div className={`w-12 h-12 bg-brand-teal/10 rounded-2xl flex items-center justify-center text-brand-teal`}>
                  <stat.icon className="w-6 h-6" />
               </div>
               <div className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-lg">
                  AKTIF
               </div>
            </div>
            <p className="text-xs font-bold text-brand-navy/30 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-1 mb-4">
               <h3 className="text-3xl font-display font-bold text-brand-navy">
                 {stat.isCurrency ? `Rp ${stat.value.toFixed(1)}jt` : stat.value}
               </h3>
               {!stat.isCurrency && <span className="text-brand-navy/20 font-bold">/{stat.target || 0}</span>}
            </div>
            
            <div className="relative h-1.5 bg-brand-navy/5 rounded-full overflow-hidden">
               <div 
                 className="absolute inset-y-0 left-0 bg-brand-teal rounded-full animate-grow-width"
                 style={{ '--final-width': `${stat.target ? (stat.value / stat.target) * 100 : 0}%` } as any}
               />
            </div>
            <p className="text-[11px] text-brand-navy/40 font-medium mt-3">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Table & Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Table Area */}
        <div className="lg:col-span-2 glass-panel p-8 rounded-[40px] animate-slide-up [animation-delay:600ms]">
          <div className="flex items-center justify-between mb-8">
             <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Kamar Terbaru</h3>
                <p className="text-xs text-brand-navy/40 mt-1">{totalRooms} kamar terdaftar • {occupiedRooms} terisi • {vacantRooms} kosong</p>
             </div>
             <Link href="/rooms" className="text-xs font-bold text-brand-teal hover:underline">Lihat Semua</Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-brand-navy/30 font-bold uppercase tracking-[0.2em] border-b border-brand-navy/5">
                  <th className="pb-4 text-left font-bold">NO.</th>
                  <th className="pb-4 text-left font-bold">KAMAR</th>
                  <th className="pb-4 text-left font-bold">STATUS</th>
                  <th className="pb-4 text-right font-bold">HARGA</th>
                  <th className="pb-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {rooms.slice(0, 5).map((room, i) => (
                  <tr 
                    key={room.id} 
                    className="group hover:bg-brand-cream/50 transition-colors ledger-border animate-slide-up"
                    style={{ animationDelay: `${700 + i * 50}ms` }}
                  >
                    <td className="py-5">
                       <div className="w-10 h-10 bg-brand-navy/5 rounded-xl flex items-center justify-center font-bold text-brand-navy group-hover:bg-brand-teal group-hover:text-white transition-all duration-300">
                          {room.room_number.slice(-2)}
                       </div>
                    </td>
                    <td className="py-5">
                       <p className="text-sm font-bold text-brand-navy">Kamar {room.room_number}</p>
                       <p className="text-[10px] text-brand-navy/40 uppercase tracking-widest">{room.description || 'Tidak ada deskripsi'}</p>
                    </td>
                    <td className="py-5">
                       <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                         room.status === 'occupied' 
                           ? 'bg-brand-teal/10 text-brand-teal animate-pulse-teal' 
                           : 'bg-amber-500/10 text-amber-600'
                       }`}>
                          {room.status === 'occupied' ? 'TERISI' : 'KOSONG'}
                       </span>
                    </td>
                    <td className="py-5 text-right text-sm font-bold text-brand-navy">Rp {room.price_per_month?.toLocaleString('id-ID')}</td>
                    <td className="py-5 text-right">
                       <button className="p-2 text-brand-navy/20 hover:text-brand-navy transition-colors">
                          <MoreHorizontal className="w-5 h-5" />
                       </button>
                    </td>
                  </tr>
                ))}
                {rooms.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-brand-navy/30 text-sm">Belum ada data kamar terdaftar.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <Link href="/rooms" className="w-full mt-8 py-4 border-t border-brand-navy/5 flex items-center justify-center gap-2 text-xs font-bold text-brand-teal hover:bg-brand-teal/5 transition-all rounded-b-3xl group">
             KELOLA SELURUH KAMAR <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Right Sidebar Area */}
        <div className="space-y-8 animate-slide-up [animation-delay:900ms]">
          {/* Mini Chart Card */}
          <div className="glass-dark p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl shadow-brand-navy/30">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-brand-teal border border-white/10">
                  <Activity className="w-5 h-5" />
                </div>
                <button className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">DETAIL</button>
              </div>
              <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Estimasi Pendapatan</h4>
              <div className="flex items-baseline gap-2 mb-8">
                 <h3 className="text-4xl font-display font-bold">Rp {monthlyRevenue.toFixed(1)}<span className="text-lg text-white/40 italic">jt</span></h3>
              </div>
              
              <div className="h-24 flex items-end gap-2">
                 {[40, 25, 60, 45, 80, 55].map((h, i) => (
                   <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                      <div 
                        className="w-full bg-brand-teal/30 rounded-t-lg transition-all duration-500 group-hover/bar:bg-brand-teal animate-grow-height origin-bottom" 
                        style={{ height: `${h}%`, animationDelay: `${1100 + i * 100}ms` } as any}
                      />
                   </div>
                 ))}
              </div>
              <div className="flex justify-between mt-4 text-[9px] font-bold text-white/20 tracking-[0.2em]">
                 <span>DES</span><span>JAN</span><span>FEB</span><span>MAR</span><span>APR</span><span>MEI</span>
              </div>
            </div>
          </div>

          {/* Occupancy Card */}
          <div className="glass-panel p-8 rounded-[40px] flex flex-col items-center text-center">
             <h4 className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-8">Tingkat Hunian</h4>
             <div className="relative w-44 h-44 mb-8">
                <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 36 36">
                  <path
                    className="text-brand-navy/5"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-brand-teal animate-stroke-fill"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray="0, 100"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    style={{ '--final-stroke': totalRooms ? (occupiedRooms / totalRooms) * 100 : 0, animationDelay: '1500ms' } as any}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <h3 className="text-4xl font-display font-bold text-brand-navy leading-none">
                     {totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0}<span className="text-xl">%</span>
                   </h3>
                   <p className="text-[9px] font-bold text-brand-navy/30 uppercase tracking-widest mt-2">OKUPANSI</p>
                </div>
             </div>
             <div className="w-full space-y-3">
                <div className="flex justify-between items-center text-xs p-3 rounded-2xl bg-brand-teal/5 border border-brand-teal/10">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-teal rounded-full" /> <span className="font-semibold text-brand-navy/60">Terisi</span></div>
                   <span className="font-bold text-brand-teal">{occupiedRooms} Unit</span>
                </div>
                <div className="flex justify-between items-center text-xs p-3 rounded-2xl border border-brand-navy/5">
                   <div className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-navy/10 rounded-full" /> <span className="font-semibold text-brand-navy/60">Kosong</span></div>
                   <span className="font-bold text-brand-navy/30">{vacantRooms} Unit</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
