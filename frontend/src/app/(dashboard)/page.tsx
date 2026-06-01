'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  Loader2,
  Calendar,
  CreditCard,
  Download,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  X,
  Building2,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getToken } from '@/lib/auth';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [tenantPayments, setTenantPayments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const userData = await apiFetch('/api/auth/me');
        setUser(userData);
        
        if (userData.role === 'tenant') {
          const [profileData, paymentsData] = await Promise.all([
            apiFetch('/api/tenants/me'),
            apiFetch('/api/payments/my')
          ]);
          setTenantProfile(profileData);
          setTenantPayments(paymentsData || []);
        } else {
          const [roomsData, tenantsData] = await Promise.all([
            apiFetch('/api/rooms'),
            apiFetch('/api/tenants')
          ]);
          setRooms(roomsData || []);
          setTenants(tenantsData || []);
        }
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

  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const revenuePercent = revenueTarget > 0 ? Math.round((monthlyRevenue / revenueTarget) * 100) : 0;

  const stats = [
    { 
      label: 'Total Kamar', 
      value: totalRooms, 
      target: totalRooms, 
      sub: `${totalRooms} terdaftar`, 
      icon: Building2, 
      iconBg: 'bg-slate-100', 
      iconColor: 'text-slate-600',
      badge: `Total: ${totalRooms}`, 
      badgeClass: 'bg-gray-100 text-gray-600',
      barColor: 'bg-slate-400',
    },
    { 
      label: 'Kamar Terisi', 
      value: occupiedRooms, 
      target: totalRooms, 
      sub: `${vacantRooms} kamar kosong`, 
      icon: Users, 
      iconBg: 'bg-teal-50', 
      iconColor: 'text-teal-600',
      badge: `${occupancyPercent}%`, 
      badgeClass: occupancyPercent >= 50 ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700',
      barColor: occupancyPercent >= 50 ? 'bg-brand-teal' : 'bg-amber-500',
    },
    { 
      label: 'Total Penghuni', 
      value: totalTenants, 
      target: totalRooms, 
      sub: 'Aktif menghuni', 
      icon: UserCheck, 
      iconBg: 'bg-emerald-50', 
      iconColor: 'text-emerald-600',
      badge: 'Aktif', 
      badgeClass: 'bg-emerald-50 text-emerald-700',
      barColor: 'bg-emerald-500',
    },
    { 
      label: 'Pendapatan (Bln)', 
      value: monthlyRevenue, 
      target: revenueTarget, 
      sub: `Target Rp ${revenueTarget.toFixed(1)}jt`, 
      icon: Wallet, 
      iconBg: 'bg-orange-50', 
      iconColor: 'text-orange-600',
      badge: `${revenuePercent}% target`, 
      badgeClass: revenuePercent >= 80 ? 'bg-emerald-50 text-emerald-700' : revenuePercent >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
      barColor: revenuePercent >= 80 ? 'bg-emerald-500' : revenuePercent >= 50 ? 'bg-amber-500' : 'bg-red-500',
      isCurrency: true 
    },
  ];

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-brand-navy/40">
        <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
        <p className="font-bold text-sm uppercase tracking-widest">Menyiapkan Dashboard...</p>
      </div>
    );
  }

  if (user?.role === 'tenant') {
    const contract = tenantProfile?.contract;
    let daysRemaining = 0;
    let percentRemaining = 0;
    if (contract && contract.end_date) {
      const end = new Date(contract.end_date).getTime();
      const start = new Date(contract.start_date).getTime();
      const now = new Date().getTime();
      const totalDuration = end - start;
      const timeRemaining = end - now;

      daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
      if (totalDuration > 0) {
        percentRemaining = Math.max(0, Math.min(100, (timeRemaining / totalDuration) * 100));
      }
    }

    const unpaidPayments = tenantPayments.filter(p => p.status === 'unpaid' || p.status === 'overdue' || p.status === 'partial');
    const hasUnpaidBill = unpaidPayments.length > 0;
    const activeBill = unpaidPayments[0];

    const copyToClipboard = () => {
      navigator.clipboard.writeText("459801035222531");
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    };

    return (
      <div className="space-y-8 max-w-[1400px] mx-auto animate-slide-up">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">PORTAL PENGHUNI KOS</p>
            <h1 className="text-4xl font-display font-bold text-brand-navy">Halo, {tenantProfile?.name || user?.name || 'Penghuni'}! 👋</h1>
            <p className="text-brand-navy/40 text-sm mt-1">Kamar {tenantProfile?.room?.room_number || '-'} • Selamat datang kembali di portal kos Anda • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-panel p-8 rounded-[40px] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-teal/5 blur-[80px] rounded-full group-hover:scale-125 transition-transform duration-700" />
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 relative z-10">
                <div>
                  <h3 className="text-2xl font-display font-bold text-brand-navy">Kamar {tenantProfile?.room?.room_number || '-'}</h3>
                  <p className="text-xs text-brand-navy/40 mt-1">{tenantProfile?.room?.description || 'Tipe Kamar Standar'}</p>
                </div>
                <span className={`inline-block px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-widest ${
                  contract?.status === 'active' 
                    ? 'bg-brand-teal/10 text-brand-teal shadow-lg shadow-brand-teal/5' 
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  KONTRAK {contract?.status === 'active' ? 'AKTIF' : 'NON-AKTIF'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-10">
                <div className="bg-brand-navy/5 p-5 rounded-2xl border border-brand-navy/5">
                  <p className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Mulai Sewa</p>
                  <p className="text-sm font-bold text-brand-navy">
                    {contract?.start_date ? new Date(contract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div className="bg-brand-navy/5 p-5 rounded-2xl border border-brand-navy/5">
                  <p className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Berakhir Sewa</p>
                  <p className="text-sm font-bold text-brand-navy">
                    {contract?.end_date ? new Date(contract.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </p>
                </div>
                <div className="bg-brand-navy/5 p-5 rounded-2xl border border-brand-navy/5">
                  <p className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Harga Sewa / Bln</p>
                  <p className="text-sm font-bold text-brand-teal">
                    Rp {(contract?.monthly_rent || tenantProfile?.room?.price_per_month) ? (contract?.monthly_rent || tenantProfile?.room?.price_per_month).toLocaleString('id-ID') : '-'}
                  </p>
                </div>
              </div>

              {contract && (
                <div className="space-y-3 relative z-10">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-brand-navy/50">Progress Masa Kontrak</span>
                    <span className={daysRemaining < 7 ? 'text-red-500 font-bold' : 'text-brand-teal font-bold'}>{daysRemaining} Hari Lagi</span>
                  </div>
                  <div className="relative h-3 bg-brand-navy/5 rounded-full overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${
                        daysRemaining < 7 ? 'bg-red-500' : 'bg-brand-teal'
                      }`}
                      style={{ width: `${percentRemaining}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-brand-navy/40 font-medium">
                    *Masa kontrak berjalan selama {contract.rental_duration} bulan. Hubungi pemilik kos jika ingin memperpanjang kontrak.
                  </p>
                </div>
              )}
            </div>

            <div className="glass-panel p-8 rounded-[40px] border-l-4 border-l-brand-teal relative overflow-hidden group">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                <div>
                  <h3 className="text-xl font-display font-bold text-brand-navy">Tagihan & Pembayaran Terkini</h3>
                  <p className="text-xs text-brand-navy/40 mt-1">Berikut adalah status tagihan aktif kamar Anda</p>
                </div>
                {hasUnpaidBill ? (
                  <span className="bg-amber-500/10 text-amber-600 text-xs font-bold px-3 py-1.5 rounded-xl uppercase tracking-widest animate-pulse">
                    Belum Lunas
                  </span>
                ) : (
                  <span className="bg-emerald-500/10 text-emerald-600 text-xs font-bold px-3 py-1.5 rounded-xl uppercase tracking-widest">
                    Semua Lunas
                  </span>
                )}
              </div>

              {hasUnpaidBill && activeBill ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-brand-navy/5 rounded-2xl border border-brand-navy/5">
                    <div>
                      <p className="text-[9px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Periode</p>
                      <p className="text-xs font-bold text-brand-navy">Bulan {activeBill.period_month} - {activeBill.period_year}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Jatuh Tempo</p>
                      <p className="text-xs font-bold text-red-500">
                        {new Date(activeBill.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Tagihan Sewa</p>
                      <p className="text-xs font-bold text-brand-navy">Rp {activeBill.amount_rent.toLocaleString('id-ID')}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-brand-navy/30 uppercase tracking-widest mb-1">Utilitas & Lainnya</p>
                      <p className="text-xs font-bold text-brand-navy">Rp {(activeBill.amount_electricity + activeBill.amount_water + activeBill.amount_other).toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 p-6 bg-brand-teal/5 border border-brand-teal/10 rounded-3xl">
                    <div>
                      <p className="text-xs text-brand-navy/40 font-bold uppercase tracking-wider mb-1">Total Tagihan Yang Harus Dibayar</p>
                      <h4 className="text-3xl font-display font-bold text-brand-teal">
                        Rp {(activeBill.amount_rent + activeBill.amount_electricity + activeBill.amount_water + activeBill.amount_other - activeBill.total_paid).toLocaleString('id-ID')}
                      </h4>
                    </div>
                    <Link href="/payments" className="bg-brand-teal hover:bg-brand-teal-light text-white text-sm font-bold px-6 py-4 rounded-2xl shadow-lg shadow-brand-teal/20 transition-all flex items-center gap-2 group w-full md:w-auto justify-center">
                       <CreditCard className="w-5 h-5" />
                       <span>Bayar Sekarang</span>
                       <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-emerald-500/5 rounded-3xl border border-emerald-500/10 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-emerald-950 text-sm">Hebat! Tidak Ada Tagihan Tertunggak</h4>
                  <p className="text-xs text-emerald-800/60 max-w-sm">
                    Terima kasih telah membayar sewa kos tepat waktu. Anda akan mendapatkan tagihan berikutnya di awal bulan depan.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="glass-dark p-8 rounded-[40px] text-white relative overflow-hidden group shadow-2xl shadow-brand-navy/30">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-teal/20 blur-[60px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-brand-teal border border-white/10">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-teal">BANK TRANSFER</span>
                </div>
                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Rekening Pembayaran Kos</h4>
                <h3 className="text-2xl font-display font-bold mb-2">BRI • 459801035222531</h3>
                <p className="text-xs text-white/50 mb-6">Atas Nama: Pemilik Properti Kos</p>
                
                <button 
                  onClick={copyToClipboard}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-bold tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-colors"
                >
                  {copiedText ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Berhasil Disalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Nomor Rekening</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="glass-panel p-8 rounded-[40px] flex flex-col items-center text-center">
               <h4 className="text-[10px] font-bold text-brand-navy/30 uppercase tracking-widest mb-6">Butuh Bantuan?</h4>
               <div className="w-12 h-12 bg-amber-500/10 text-amber-600 rounded-full flex items-center justify-center mb-4">
                 <Info className="w-6 h-6" />
               </div>
               <h4 className="font-bold text-brand-navy text-sm mb-2">Lapor Kerusakan & Masalah</h4>
               <p className="text-xs text-brand-navy/50 mb-6">
                 AC bocor? Air kamar mandi mati? Kirim keluhan fasilitas kamar Anda dan pantau penanganannya langsung di sini.
               </p>
               <Link href="/complaints" className="w-full py-3 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy text-xs font-bold rounded-2xl transition-colors border border-brand-navy/5">
                 KIRIM KOMPLAIN SEKARANG
               </Link>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[40px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-display font-bold text-brand-navy">Riwayat Pembayaran Saya</h3>
              <p className="text-xs text-brand-navy/40 mt-1">Daftar transaksi pembayaran kos yang pernah dilakukan</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-brand-navy/30 font-bold uppercase tracking-[0.2em] border-b border-brand-navy/5">
                  <th className="pb-4 text-left font-bold">PERIODE</th>
                  <th className="pb-4 text-left font-bold">METODE</th>
                  <th className="pb-4 text-left font-bold">STATUS</th>
                  <th className="pb-4 text-right font-bold">TAGIHAN</th>
                  <th className="pb-4 text-right font-bold">DIBAYAR</th>
                  <th className="pb-4 text-right font-bold">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-navy/5">
                {tenantPayments.map((p, i) => {
                  const totalBill = p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
                  return (
                    <tr 
                      key={p.id} 
                      className="group hover:bg-brand-cream/50 transition-colors ledger-border"
                    >
                      <td className="py-4 text-sm font-bold text-brand-navy">
                        Bulan {p.period_month} - {p.period_year}
                      </td>
                      <td className="py-4 text-sm text-brand-navy/60 font-semibold uppercase">
                        {p.payment_method || '-'}
                      </td>
                      <td className="py-4">
                        <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                          p.status === 'paid' 
                            ? 'bg-emerald-500/10 text-emerald-600' 
                            : p.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-red-500/10 text-red-500'
                        }`}>
                          {p.status === 'paid' ? 'LUNAS' : p.status === 'pending' ? 'TERTUNDA' : 'BELUM BAYAR'}
                        </span>
                      </td>
                      <td className="py-4 text-right text-sm font-bold text-brand-navy">
                        Rp {totalBill.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 text-right text-sm font-bold text-brand-teal">
                        Rp {p.total_paid.toLocaleString('id-ID')}
                      </td>
                      <td className="py-4 text-right">
                        {p.status === 'paid' && (
                          <button 
                            onClick={() => setSelectedReceipt(p)}
                            className="inline-flex items-center gap-1.5 bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Kwitansi</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tenantPayments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-brand-navy/30 text-sm">Belum ada riwayat transaksi pembayaran.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
          <Link href="/tenants" className="px-4 py-2 bg-white hover:bg-gray-50 text-brand-navy text-sm font-bold rounded-xl border-[1.5px] border-gray-200 transition-all flex items-center gap-2 shadow-sm">
             <Users className="w-4 h-4 text-brand-teal" />
             Data Penghuni
          </Link>
          <Link href="/rooms" className="px-4 py-2 bg-brand-teal hover:bg-brand-teal-light text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm group">
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> Manajemen Kamar
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
          <Link href="/payments" className="text-amber-700 text-xs font-bold uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
             Lihat Pembayaran <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 animate-slide-up relative overflow-hidden group"
            style={{ animationDelay: `${200 + i * 100}ms` }}
          >
            <div className="flex justify-between items-start mb-3">
               <div className={`w-11 h-11 ${stat.iconBg} rounded-xl flex items-center justify-center ${stat.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon className="w-5 h-5" />
               </div>
               <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${stat.badgeClass}`}>
                   {stat.badge}
               </span>
            </div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-1.5 mb-3">
               <h3 className="text-3xl font-display font-bold text-brand-navy">
                 {stat.isCurrency ? `Rp ${stat.value.toFixed(1)}jt` : stat.value}
               </h3>
               {!stat.isCurrency && <span className="text-brand-navy/20 font-bold text-lg">/{stat.target || 0}</span>}
            </div>
            
            <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
               <div 
                 className={`absolute inset-y-0 left-0 rounded-full animate-grow-width ${stat.barColor}`}
                 style={{ '--final-width': `${stat.target ? (stat.value / stat.target) * 100 : 0}%` } as any}
               />
            </div>
            <p className="text-[11px] text-gray-400 font-medium mt-2.5">{stat.sub}</p>
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
        <div className="space-y-6 animate-slide-up [animation-delay:900ms]">
          {/* Revenue Mini Card */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-navy">Estimasi Pendapatan</h4>
                  <p className="text-[10px] text-gray-400">6 bulan terakhir</p>
                </div>
              </div>
              <span className="text-lg font-display font-bold text-brand-navy">Rp {monthlyRevenue.toFixed(1)}<span className="text-xs text-gray-400 font-normal">jt</span></span>
            </div>
            <div className="h-20 flex items-end gap-1.5">
               {[40, 25, 60, 45, 80, 55].map((h, i) => (
                 <div key={i} className="flex-1 group/bar relative h-full flex items-end">
                    <div 
                      className="w-full bg-brand-teal/20 hover:bg-brand-teal rounded-t-md transition-all duration-300 animate-grow-height origin-bottom" 
                      style={{ height: `${h}%`, animationDelay: `${1100 + i * 100}ms` } as any}
                    />
                 </div>
               ))}
            </div>
            <div className="flex justify-between mt-2 text-[9px] font-bold text-gray-300 tracking-wider">
               <span>Des</span><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>Mei</span>
            </div>
          </div>

          {/* Occupancy Donut Card */}
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-6 shadow-sm hover:shadow-md transition-all">
             <h4 className="text-xs font-bold text-brand-navy mb-5">Tingkat Hunian</h4>
             <div className="flex items-center gap-6">
               <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-gray-100"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="text-brand-teal animate-stroke-fill"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeDasharray="0, 100"
                      strokeLinecap="round"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      style={{ '--final-stroke': totalRooms ? (occupiedRooms / totalRooms) * 100 : 0, animationDelay: '1500ms' } as any}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                     <h3 className="text-xl font-display font-bold text-brand-navy leading-none">
                       {occupancyPercent}<span className="text-sm">%</span>
                     </h3>
                  </div>
               </div>
               <div className="flex-1 space-y-2.5">
                  <div className="flex justify-between items-center text-xs p-2.5 rounded-xl bg-teal-50/60 border border-teal-100">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 bg-brand-teal rounded-full" /> <span className="font-medium text-gray-600">Terisi</span></div>
                     <span className="font-bold text-brand-teal">{occupiedRooms}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs p-2.5 rounded-xl border border-gray-100">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 bg-gray-200 rounded-full" /> <span className="font-medium text-gray-600">Kosong</span></div>
                     <span className="font-bold text-gray-400">{vacantRooms}</span>
                  </div>
               </div>
             </div>
          </div>
        </div>
      </div>
      {/* Modal: Receipt Modal (Cetak Kwitansi Lokal) */}
      {selectedReceipt && mounted && createPortal(
        <div id="print-receipt-portal-wrapper">
          <ReceiptModal payment={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
        </div>
      , document.body)}
    </div>
  );
}

interface ReceiptModalProps {
  payment: any;
  onClose: () => void;
}

function ReceiptModal({ payment, onClose }: ReceiptModalProps) {
  const totalBill = payment.amount_rent + payment.amount_electricity + payment.amount_water + payment.amount_other;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const roomNumber = payment.contract?.room?.room_number || '-';
  const tenantName = payment.contract?.tenant?.name || '-';
  const tenantPhone = payment.contract?.tenant?.phone || '-';

  return (
    <div 
      id="receipt-modal-backdrop"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto"
      style={{
        position: 'fixed',
        inset: 0,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(11, 31, 53, 0.45)'
      }}
    >
      <div id="print-receipt-modal" className="bg-white rounded-[32px] p-8 max-w-[600px] w-full shadow-2xl relative my-auto animate-slide-up flex flex-col max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-brand-navy transition-colors p-2 rounded-full hover:bg-gray-100 no-print"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center pb-6 mb-6">
          <h1 className="text-2xl font-display font-bold text-brand-navy">Lapor Kos</h1>
          <p className="text-xs text-gray-400 mt-1">Bukti Pembayaran Digital Resmi</p>
          <span className="inline-block px-4 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full mt-3 tracking-widest uppercase border border-emerald-200">
            {payment.status === 'paid' ? 'LUNAS' : payment.status === 'pending' ? 'TERTUNDA' : payment.status === 'partial' ? 'SEBAGIAN' : 'BELUM BAYAR'}
          </span>
        </div>

        <div className="border-b border-dashed border-gray-300 my-6"></div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs mb-8 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">No. Invoice</p>
            <p className="font-bold text-brand-navy text-sm">#PAY-{payment.id.split('-')[0].toUpperCase()}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">Kamar Kos</p>
            <p className="font-bold text-brand-navy text-sm">Kamar {roomNumber}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">Nama Penghuni</p>
            <p className="font-bold text-brand-navy text-sm">{tenantName}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">No. Telepon</p>
            <p className="font-bold text-brand-navy text-sm">{tenantPhone}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">Periode</p>
            <p className="font-bold text-brand-navy text-sm">Bulan {payment.period_month} - {payment.period_year}</p>
          </div>
          <div>
            <p className="text-gray-400 font-semibold mb-0.5 uppercase tracking-wider text-[10px]">Tanggal Bayar</p>
            <p className="font-bold text-brand-navy text-sm">{formatDate(payment.paid_at || payment.created_at)}</p>
          </div>
        </div>

        <table className="w-full text-left text-xs mb-6 border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              <th className="p-3 text-gray-500 font-bold uppercase tracking-wider text-[10px]">Deskripsi Layanan</th>
              <th className="p-3 text-right text-gray-500 font-bold uppercase tracking-wider text-[10px]">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr>
              <td className="p-3 font-medium text-gray-600">Sewa Kamar Bulanan</td>
              <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(payment.amount_rent)}</td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-gray-600">Biaya Listrik</td>
              <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(payment.amount_electricity)}</td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-gray-600">Biaya Air</td>
              <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(payment.amount_water)}</td>
            </tr>
            <tr>
              <td className="p-3 font-medium text-gray-600">Biaya Tambahan Lainnya</td>
              <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(payment.amount_other)}</td>
            </tr>
            <tr className="bg-gray-50 font-bold text-sm border-t-2 border-gray-300">
              <td className="p-3 text-gray-700">Total Tagihan</td>
              <td className="p-3 text-right text-brand-navy">{formatCurrency(totalBill)}</td>
            </tr>
            <tr className="bg-emerald-50 text-emerald-800 font-bold text-sm border-t border-b border-emerald-200">
              <td className="p-3 rounded-l-xl">Total Dibayar ({payment.payment_method || '-'})</td>
              <td className="p-3 text-right rounded-r-xl">{formatCurrency(payment.total_paid)}</td>
            </tr>
          </tbody>
        </table>

        {payment.notes && (
          <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
            <p className="text-gray-400 font-semibold mb-1">Catatan Pemilik</p>
            <p className="font-medium text-brand-navy italic">"{payment.notes}"</p>
          </div>
        )}

        <div className="text-center border-t border-gray-100 pt-6 text-[10px] text-gray-400">
          <p className="mb-1 font-medium">Terima kasih atas pembayaran Anda.</p>
          <p>Kwitansi ini sah dan diterbitkan secara elektronik oleh Lapor Kos.</p>
        </div>

        <div className="mt-8 flex gap-3 no-print">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border-[1.5px] border-gray-200 hover:bg-gray-50 text-brand-navy font-bold rounded-xl text-xs transition-colors"
          >
            Tutup
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-3 bg-brand-teal hover:bg-brand-teal-light text-white font-bold rounded-xl text-xs shadow-lg shadow-brand-teal/20 transition-all flex items-center justify-center gap-2"
          >
            Cetak Kwitansi (PDF)
          </button>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body > *:not(#print-receipt-portal-wrapper) {
            display: none !important;
          }
          body {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #print-receipt-portal-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          #receipt-modal-backdrop {
            position: static !important;
            background: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            padding: 0 !important;
            display: block !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          #print-receipt-modal {
            box-shadow: none !important;
            border: 1px solid #e2e8f0 !important;
            background: white !important;
            color: black !important;
            max-width: 600px !important;
            width: 100% !important;
            margin: 20mm auto !important;
            padding: 40px !important;
            border-radius: 24px !important;
            position: relative !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
            max-height: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
