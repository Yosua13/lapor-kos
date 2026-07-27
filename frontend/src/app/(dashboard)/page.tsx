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
  UserCheck,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/features/session/SessionProvider';
import { useActiveProperty } from '@/features/properties/PropertyProvider';

export default function DashboardPage() {
	const { user } = useSession();
	const { activeProperty, isLoading: isPropertyLoading } = useActiveProperty();
  const [tenantProfile, setTenantProfile] = useState<any>(null);
  const [tenantPayments, setTenantPayments] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [revenuePeriod, setRevenuePeriod] = useState<number>(6);

  useEffect(() => {
    setMounted(true);
    const fetchData = async () => {
	  if (!user || isPropertyLoading) return;
	  // A new owner has no selected property yet. DashboardShell renders the
	  // onboarding state, so do not send property-scoped API requests that
	  // would otherwise fail with a missing property context.
	  if (user.role !== 'tenant' && !activeProperty) {
		setIsLoading(false);
		return;
	  }
      setIsLoading(true);
      try {
		if (user.role === 'tenant') {
          const [profileData, paymentsData] = await Promise.all([
            apiFetch('/api/tenants/me'),
            apiFetch('/api/payments/my')
          ]);
          setTenantProfile(profileData);
          setTenantPayments(paymentsData || []);
        } else {
          const [roomsData, contractsData, paymentsData, complaintsData] = await Promise.all([
            apiFetch('/api/rooms'),
            apiFetch('/api/contracts'),
            apiFetch('/api/payments'),
            apiFetch('/api/complaints')
          ]);
          setRooms(roomsData || []);
          setContracts(contractsData || []);
          setPayments(paymentsData || []);
          setComplaints(complaintsData || []);
          
          // Map unique users with active contracts to simulate 'tenants' count
          const activeContracts = (contractsData || []).filter((c: any) => c.status === 'active');
          const uniqueTenantIds = new Set(activeContracts.map((c: any) => c.user_id));
          setTenants(Array.from(uniqueTenantIds));
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
	}, [activeProperty, isPropertyLoading, user]);

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
  const vacantRooms = totalRooms - occupiedRooms;
  const totalTenants = tenants.length;
  const totalComplaints = complaints.length;
  const resolvedComplaints = complaints.filter(c => c.status === 'resolved').length;

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const monthlyPaidPayments = payments.filter((p: any) => 
    p.status === 'paid' && 
    p.period_month === currentMonth && 
    p.period_year === currentYear
  );
  
  const monthlyRevenue = monthlyPaidPayments.reduce((sum: number, p: any) => sum + p.total_paid, 0);
  const occupancyPercent = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const resolutionPercent = totalComplaints > 0 ? Math.round((resolvedComplaints / totalComplaints) * 100) : 0;

  // Calculate action triggers dynamically
  const overduePaymentsCount = payments.filter((p: any) => {
    if (p.status === 'overdue') return true;
    if (p.status === 'unpaid' || p.status === 'partial') {
      return new Date(p.due_date).getTime() < new Date().getTime();
    }
    return false;
  }).length;

  const contractsExpiringSoonCount = contracts.filter((c: any) => {
    if (c.status !== 'active' || !c.end_date) return false;
    const diffTime = new Date(c.end_date).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  const activeContracts = contracts.filter((c: any) => c.status === 'active');
  const incompleteDocsCount = activeContracts.filter((c: any) => {
    const userObj = c.user;
    return !userObj?.ktp_url || !userObj?.selfie_url;
  }).length;

  // Map 5 rooms with active tenants
  const roomsWithTenants = rooms.slice(0, 5).map(room => {
    const activeContract = contracts.find((c: any) => c.room_id === room.id && c.status === 'active');
    return {
      ...room,
      tenantName: activeContract?.user?.name || '—',
      tenantPhone: activeContract?.user?.phone || '',
      checkInDate: activeContract?.start_date 
        ? new Date(activeContract.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Belum ada penghuni'
    };
  });

  // Calculate past months revenue dynamically
  const getPastMonthsData = (period: number) => {
    const months = [];
    const now = new Date();
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: d.toLocaleDateString('id-ID', { month: 'short' }),
        revenue: 0,
      });
    }
    
    months.forEach(m => {
      const paidInMonth = payments.filter((p: any) => 
        p.status === 'paid' && 
        p.period_month === m.month && 
        p.period_year === m.year
      );
      m.revenue = paidInMonth.reduce((sum, p) => sum + p.total_paid, 0);
    });
    
    return months;
  };
  const lastMonths = getPastMonthsData(revenuePeriod);
  const totalPeriodRevenue = lastMonths.reduce((sum, m) => sum + m.revenue, 0);
  const maxRevenue = Math.max(...lastMonths.map(m => m.revenue), 1000000);

  const formatMillion = (amount: number) => {
    if (amount === 0) return 'Rp 0';
    const inMillions = amount / 1000000;
    return `Rp ${inMillions.toFixed(1).replace('.', ',')} jt`;
  };

  const currentMonthPayments = payments.filter((p: any) => 
    p.period_month === currentMonth && 
    p.period_year === currentYear
  );

  const totalBilled = currentMonthPayments.reduce((sum: number, p: any) => {
    return sum + (p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other);
  }, 0);

  const collectionPercent = totalBilled > 0 ? Math.round((monthlyRevenue / totalBilled) * 100) : 0;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  const prevMonthPayments = payments.filter((p: any) => 
    p.status === 'paid' && 
    p.period_month === prevMonth && 
    p.period_year === prevYear
  );
  const prevMonthRevenue = prevMonthPayments.reduce((sum: number, p: any) => sum + p.total_paid, 0);
  const revenueGrowth = prevMonthRevenue > 0 
    ? Math.round(((monthlyRevenue - prevMonthRevenue) / prevMonthRevenue) * 100)
    : 0;

  const revenueSub = totalBilled > 0 
    ? `Terkumpul ${collectionPercent}% dari tagihan bulan ini`
    : (prevMonthRevenue > 0 
        ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}% dari bulan lalu`
        : `${monthlyPaidPayments.length} pembayaran lunas bulan ini`);

  const stats = [
    { 
      label: 'Kamar Terisi', 
      value: `${occupiedRooms}`, 
      target: totalRooms, 
      sub: `${occupiedRooms} dari ${totalRooms} kamar terisi`, 
      icon: Users, 
      iconBg: 'bg-teal-50', 
      iconColor: 'text-teal-600',
      badge: `${occupancyPercent}%`, 
      badgeClass: occupancyPercent >= 50 ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-amber-50 text-amber-700 border border-amber-100',
      barColor: occupancyPercent >= 50 ? 'bg-brand-teal' : 'bg-amber-500',
      barBgColor: 'group-hover:bg-brand-teal',
      percent: occupancyPercent,
    },
    { 
      label: 'Total Penghuni', 
      value: `${totalTenants}`, 
      target: totalRooms, 
      sub: 'Aktif menghuni', 
      icon: UserCheck, 
      iconBg: 'bg-indigo-50', 
      iconColor: 'text-indigo-600',
      badge: 'Aktif', 
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
      barColor: 'bg-indigo-500',
      barBgColor: 'group-hover:bg-indigo-500',
      percent: totalRooms > 0 ? Math.round((totalTenants / totalRooms) * 100) : 0,
    },
    { 
      label: 'Total Komplain', 
      value: `${totalComplaints}`, 
      target: totalComplaints, 
      sub: `${resolvedComplaints} komplain selesai`, 
      icon: MessageSquare, 
      iconBg: 'bg-rose-50', 
      iconColor: 'text-rose-600',
      badge: `${resolvedComplaints}/${totalComplaints}`, 
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-100',
      barColor: 'bg-rose-500',
      barBgColor: 'group-hover:bg-rose-500',
      percent: resolutionPercent,
    },
    { 
      label: 'Pendapatan Bulan Ini', 
      value: `Rp ${monthlyRevenue.toLocaleString('id-ID')}`, 
      target: totalBilled || prevMonthRevenue || 1, 
      sub: revenueSub, 
      icon: Wallet, 
      iconBg: 'bg-emerald-50', 
      iconColor: 'text-emerald-600',
      badge: totalBilled > 0 
        ? `${collectionPercent}%`
        : (prevMonthRevenue > 0 ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%` : 'Bulan Ini'), 
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
      barColor: 'bg-emerald-500',
      barBgColor: 'group-hover:bg-emerald-500',
      percent: totalBilled > 0
        ? Math.min(100, collectionPercent)
        : (prevMonthRevenue > 0 ? Math.min(100, Math.max(0, Math.round((monthlyRevenue / prevMonthRevenue) * 100))) : 0),
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
      <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full space-y-6 animate-slide-up -mt-4 lg:-mt-8 pb-10">
        <div className="shrink-0 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Halo, {tenantProfile?.name || user?.name || 'Penghuni'}! 👋</h1>
            <p className="text-[15px] text-gray-500 mt-1">Kamar {tenantProfile?.room?.room_number || '-'} • Selamat datang kembali di portal kos Anda • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

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
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full space-y-6 animate-slide-up -mt-4 lg:-mt-8 pb-10">
      {/* Header Section */}
      <div className="shrink-0 mb-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Dashboard</h1>
          <p className="text-[15px] text-gray-500 mt-1">Pantau status kos Anda dalam satu tampilan • {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/tenants" className="px-5 py-2 bg-white hover:bg-gray-50 text-brand-navy text-[13px] font-bold rounded-full border border-gray-200 shadow-sm transition-all flex items-center gap-2">
             <Users className="w-4 h-4 text-brand-teal" />
             Data Penghuni
          </Link>
          <Link href="/rooms" className="px-5 py-2 bg-[#0e8a7a] hover:bg-[#0c7567] text-white text-[13px] font-bold rounded-full shadow-sm transition-all flex items-center gap-2 group">
             <Plus className="w-4 h-4" />
             Manajemen Kamar
          </Link>
        </div>
      </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            className="bg-white border-[1.5px] border-gray-200 rounded-[20px] p-5 shadow-sm hover:shadow-lg transition-all duration-300 animate-slide-up relative overflow-hidden group"
            style={{ animationDelay: `${200 + i * 100}ms` }}
          >
            {/* Top Accent Bar */}
            <div className={`absolute top-0 left-0 w-full h-[3px] bg-gray-200 ${stat.barBgColor} transition-colors duration-300`} />
            
            <div className="flex justify-between items-start mb-4">
               <div className={`w-10 h-10 ${stat.iconBg} rounded-xl flex items-center justify-center ${stat.iconColor} group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}>
                  <stat.icon className="w-5 h-5" />
               </div>
               <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${stat.badgeClass}`}>
                   {stat.badge}
               </span>
            </div>
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-1.5">
               <h3 className="text-3xl font-display font-bold text-brand-navy">
                 {stat.value}
               </h3>
            </div>
            <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden mt-3.5">
                <div 
                  className={`absolute inset-y-0 left-0 rounded-full animate-grow-width ${stat.barColor}`}
                  style={{ '--final-width': `${stat.percent}%` } as any}
                />
             </div>
             <p className="text-[11px] text-gray-400 font-medium mt-3">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Middle Grid Row: 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Table Area (Kamar Terbaru) */}
        <div className="glass-panel rounded-[40px] flex flex-col overflow-hidden animate-slide-up [animation-delay:600ms]">
          <div className="p-6 flex-1">
            <div className="flex items-center justify-between mb-6">
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
                    <th className="pb-4 text-left font-bold">KAMAR</th>
                    <th className="pb-4 text-left font-bold">PENGHUNI</th>
                    <th className="pb-4 text-left font-bold">STATUS</th>
                    <th className="pb-4 text-right font-bold">HARGA / BLN</th>
                    <th className="pb-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-navy/5">
                  {roomsWithTenants.map((room, i) => (
                    <tr 
                      key={room.id} 
                      className="group hover:bg-brand-cream/50 transition-colors ledger-border animate-slide-up"
                      style={{ animationDelay: `${700 + i * 50}ms` }}
                    >
                      <td className="py-3">
                         <p className="text-sm font-bold text-brand-navy">Kamar {room.room_number}</p>
                         <p className="text-[10px] text-brand-navy/40 uppercase tracking-widest">{room.floor ? `Lantai ${room.floor}` : '-'}</p>
                      </td>
                      <td className="py-3">
                         <p className="text-sm font-bold text-brand-navy">{room.tenantName}</p>
                         <p className="text-[10px] text-brand-navy/40 font-medium">
                           {room.tenantName !== '—' ? `Masuk ${room.checkInDate}` : 'Belum ada penghuni'}
                         </p>
                      </td>
                      <td className="py-3">
                         <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                           room.status === 'occupied' 
                             ? 'bg-emerald-500/10 text-emerald-600' 
                             : 'bg-amber-500/10 text-amber-600'
                         }`}>
                            {room.status === 'occupied' ? 'TERISI' : 'KOSONG'}
                         </span>
                      </td>
                      <td className="py-3 text-right text-sm font-bold text-brand-navy">
                        Rp {room.price_per_month?.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 text-right">
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
          </div>
          
          <Link href="/rooms" className="w-full py-4 border-t border-brand-navy/5 flex items-center justify-center gap-2 text-xs font-bold text-brand-teal hover:bg-brand-teal/5 transition-all group">
             KELOLA SELURUH KAMAR <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Action Needed Card */}
        <div className="glass-panel p-6 rounded-[40px] animate-slide-up [animation-delay:800ms]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Perlu Ditindaklanjuti</h3>
                <p className="text-xs text-brand-navy/40 mt-1">Tugas penting yang memerlukan perhatian Anda</p>
              </div>
              <Link href="/tenants" className="text-xs font-bold text-brand-teal hover:underline">Lihat Semua</Link>
            </div>

            <div className="space-y-3">
              {/* Overdue Payments */}
              <Link href="/payments" className="flex items-center justify-between p-4 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/50 rounded-2xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-navy text-xs">Pembayaran Terlambat</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{overduePaymentsCount} penghuni memiliki pembayaran yang terlambat</p>
                  </div>
                </div>
                <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                  {overduePaymentsCount}
                </div>
              </Link>

              {/* Expiring Contracts */}
              <Link href="/tenants" className="flex items-center justify-between p-4 bg-amber-50/50 hover:bg-amber-50 border border-amber-100/50 rounded-2xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-navy text-xs">Kontrak Akan Berakhir</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{contractsExpiringSoonCount} kontrak berakhir dalam 30 hari ke depan</p>
                  </div>
                </div>
                <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                  {contractsExpiringSoonCount}
                </div>
              </Link>

              {/* Incomplete Documents */}
              <Link href="/tenants" className="flex items-center justify-between p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/50 rounded-2xl transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brand-navy text-xs">Dokumen Belum Lengkap</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{incompleteDocsCount} penghuni belum melengkapi dokumen</p>
                  </div>
                </div>
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                  {incompleteDocsCount}
                </div>
              </Link>
            </div>
          </div>

          <Link href="/tenants" className="w-full mt-5 py-3 border border-brand-teal/20 text-brand-teal bg-brand-teal/5 hover:bg-brand-teal hover:text-white rounded-2xl text-center text-xs font-bold transition-all block">
            Tindaklanjuti Sekarang
          </Link>
        </div>

        {/* Keluhan & Komplain Card (Replaces Portal Tenant) */}
        <div className="glass-panel rounded-[40px] flex flex-col overflow-hidden animate-slide-up [animation-delay:900ms]">
          <div className="p-6 flex-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Keluhan & Komplain</h3>
                <p className="text-xs text-brand-navy/40 mt-1">Daftar laporan keluhan dari penyewa</p>
              </div>
              <span className="bg-brand-teal/10 text-brand-teal text-[10px] font-bold px-3 py-1.5 rounded-xl uppercase tracking-widest border border-brand-teal/20">
                Pratinjau
              </span>
            </div>

            <div className="space-y-3">
              {complaints.slice(0, 3).map((item) => {
                const getCategoryLabelAndColor = (cat: string) => {
                  switch (cat) {
                    case 'noisy': return { label: 'Keributan', bg: 'bg-amber-50 text-amber-600 border-amber-100' };
                    case 'facility': return { label: 'Fasilitas', bg: 'bg-rose-50 text-rose-600 border-rose-100' };
                    case 'cleanliness': return { label: 'Kebersihan', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
                    case 'security': return { label: 'Keamanan', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
                    default: return { label: 'Lainnya', bg: 'bg-slate-50 text-slate-600 border-slate-100' };
                  }
                };
                const getStatusLabelAndColor = (status: string) => {
                  switch (status) {
                    case 'pending': return { label: 'Baru', bg: 'bg-rose-500/10 text-rose-600' };
                    case 'processed': return { label: 'Diproses', bg: 'bg-blue-500/10 text-blue-600' };
                    default: return { label: 'Selesai', bg: 'bg-emerald-500/10 text-emerald-600' };
                  }
                };

                const catInfo = getCategoryLabelAndColor(item.category);
                const statusInfo = getStatusLabelAndColor(item.status);

                return (
                  <Link 
                    href={`/complaints/${item.id}`} 
                    key={item.id}
                    className="block p-3.5 bg-brand-navy/5 hover:bg-brand-cream/40 border border-brand-navy/5 rounded-2xl transition-all"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-brand-navy text-sm truncate max-w-[150px]">{item.title}</h4>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-brand-navy/50 font-medium">
                      <span>Kamar {item.room_number || '-'}</span>
                      <span>•</span>
                      <span>{item.tenant_name || item.user_name || 'Penghuni'}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                      {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </Link>
                );
              })}
              {complaints.length === 0 && (
                <div className="py-12 text-center text-brand-navy/30 text-xs border border-dashed border-brand-navy/10 rounded-2xl flex flex-col items-center justify-center gap-2">
                  <MessageSquare className="w-8 h-8 text-brand-navy/20" />
                  <span>Belum ada laporan komplain.</span>
                </div>
              )}
            </div>
          </div>

          <Link href="/complaints" className="w-full py-4 border-t border-brand-navy/5 flex items-center justify-center gap-2 text-xs font-bold text-brand-teal hover:bg-brand-teal/5 transition-all group">
            KELOLA SELURUH KOMPLAIN <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Bottom Grid Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Occupancy Donut Card */}
        <div className="lg:col-span-4 bg-white border-[1.5px] border-gray-200 rounded-[30px] p-6 shadow-sm hover:shadow-md transition-all">
           <h4 className="text-sm font-extrabold text-brand-navy uppercase tracking-wider mb-5">Okupansi Kamar</h4>
           <div className="flex items-center gap-6">
             <div className="relative w-28 h-28 shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-emerald-500 animate-stroke-fill"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray="0, 100"
                    strokeLinecap="round"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    style={{ '--final-stroke': totalRooms ? (occupiedRooms / totalRooms) * 100 : 0, animationDelay: '1500ms' } as any}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                   <h3 className="text-2xl font-display font-bold text-brand-navy leading-none">
                     {occupancyPercent}<span className="text-sm">%</span>
                   </h3>
                   <span className="text-[10px] text-gray-400 font-bold mt-1 uppercase">Terisi</span>
                </div>
             </div>
             <div className="flex-1 space-y-3">
                <div className="flex justify-between items-center text-xs">
                   <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> 
                      <span className="font-semibold text-gray-600">Terisi</span>
                   </div>
                   <span className="font-bold text-emerald-600">{occupiedRooms} ({occupancyPercent}%)</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                   <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> 
                      <span className="font-semibold text-gray-600">Kosong</span>
                   </div>
                   <span className="font-bold text-amber-500">{vacantRooms} ({totalRooms > 0 ? Math.round((vacantRooms / totalRooms) * 100) : 0}%)</span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center text-xs font-bold text-brand-navy">
                   <span>Total Kamar</span>
                   <span>{totalRooms} kamar</span>
                </div>
             </div>
           </div>
        </div>

        {/* Revenue Card (Dynamic period) */}
        <div className="lg:col-span-8 bg-white border-[1.5px] border-gray-200 rounded-[30px] p-6 shadow-sm hover:shadow-md transition-all">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h4 className="text-sm font-extrabold text-brand-navy uppercase tracking-wider">Pendapatan ({revenuePeriod} Bulan Terakhir)</h4>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <select 
                    value={revenuePeriod} 
                    onChange={(e) => setRevenuePeriod(Number(e.target.value))}
                    className="text-xs font-bold text-gray-500 bg-white border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-teal transition-all cursor-pointer appearance-none pr-8 relative shadow-sm"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '1.25rem',
                      backgroundRepeat: 'no-repeat'
                    }}
                  >
                    <option value={3}>3 Bulan</option>
                    <option value={6}>6 Bulan</option>
                    <option value={12}>12 Bulan</option>
                  </select>
                </div>
                <Link href="/payments" className="text-xs font-bold text-brand-teal hover:underline">Lihat Laporan</Link>
              </div>
            </div>

            <div className="h-28 flex items-end gap-3 mt-8">
               {lastMonths.map((m, i) => {
                 const heightPercent = maxRevenue > 0 ? (m.revenue / maxRevenue) * 80 : 0; // scale to 80% max height
                 return (
                   <div key={i} className="flex-1 group/bar relative h-full flex flex-col justify-end items-center">
                      {/* Value label above the bar */}
                      <span className="text-[8px] font-extrabold text-brand-navy mb-1.5 opacity-0 group-hover/bar:opacity-100 md:opacity-100 transition-opacity duration-300">
                        {formatMillion(m.revenue)}
                      </span>
                      <div 
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 hover:from-teal-600 hover:to-teal-400 rounded-t-lg transition-all duration-500 animate-grow-height origin-bottom" 
                        style={{ height: `${Math.max(5, heightPercent)}%`, animationDelay: `${200 + i * 50}ms` } as any}
                      />
                      <span className="text-[10px] font-bold text-gray-400 mt-2">
                        {m.label}
                      </span>
                   </div>
                 );
               })}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-4 flex justify-between items-center">
            <span className="text-xs text-gray-400 font-bold">Total {revenuePeriod} Bulan</span>
            <span className="text-sm font-extrabold text-emerald-600">Rp {totalPeriodRevenue.toLocaleString('id-ID')}</span>
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
  const depositVal = payment.contract?.deposit || 0;
  const hasDepositInThisPayment = depositVal > 0 && payment.amount_other >= depositVal;
  const displayOther = hasDepositInThisPayment ? payment.amount_other - depositVal : payment.amount_other;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  const roomNumber = payment.contract?.room?.room_number || '-';
  const tenantName = payment.contract?.user?.name || '-';
  const tenantPhone = payment.contract?.user?.phone || '-';

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
              <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(displayOther)}</td>
            </tr>
            {hasDepositInThisPayment && (
              <tr>
                <td className="p-3 font-medium text-gray-600">Uang Jaminan (Deposito)</td>
                <td className="p-3 text-right font-bold text-brand-navy">{formatCurrency(depositVal)}</td>
              </tr>
            )}
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
