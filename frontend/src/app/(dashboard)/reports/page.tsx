'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  TrendingUp,
  X,
  Wallet
} from 'lucide-react';
import { apiBlob, apiFetch } from '@/lib/api';

interface Payment {
  id: string;
  period_month: number;
  period_year: number;
  amount_rent: number;
  amount_electricity: number;
  amount_water: number;
  amount_other: number;
  total_paid: number;
  status: 'unpaid' | 'pending' | 'paid' | 'partial' | 'overdue' | string;
  due_date: string;
  paid_at?: string | null;
  created_at: string;
  payment_method?: string;
  notes?: string;
  contract?: {
    room?: {
      room_number?: string;
    };
    user?: {
      name?: string;
      phone?: string;
    };
  };
}

interface UserData {
  name?: string;
  email?: string;
  role?: string;
}

const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const getBillTotal = (payment: Payment) => {
  return (
    (payment.amount_rent || 0) +
    (payment.amount_electricity || 0) +
    (payment.amount_water || 0) +
    (payment.amount_other || 0)
  );
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'paid':
      return 'Lunas';
    case 'pending':
      return 'Menunggu';
    case 'partial':
      return 'Sebagian';
    case 'overdue':
      return 'Terlambat';
    default:
      return 'Belum Bayar';
  }
};

export default function ReportsPage() {
  const [mounted, setMounted] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>(String(new Date().getFullYear()));
  const reportFrameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const fetchReportData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [userData, paymentsData] = await Promise.all([
          apiFetch('/api/auth/me'),
          apiFetch('/api/payments')
        ]);
        setUser(userData as UserData);
        setPayments((paymentsData || []) as Payment[]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data laporan');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReportData();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const years = useMemo(() => {
    const yearSet = new Set<number>(payments.map((payment) => payment.period_year));
    yearSet.add(new Date().getFullYear());
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const yearMatch = filterYear === 'all' || payment.period_year === Number(filterYear);
      const monthMatch = filterMonth === 'all' || payment.period_month === Number(filterMonth);
      return yearMatch && monthMatch;
    });
  }, [filterMonth, filterYear, payments]);

  const reportTitle = useMemo(() => {
    const monthText = filterMonth === 'all' ? 'Semua Bulan' : monthNames[Number(filterMonth) - 1];
    const yearText = filterYear === 'all' ? 'Semua Tahun' : filterYear;
    return `${monthText} ${yearText}`;
  }, [filterMonth, filterYear]);

  const summary = useMemo(() => {
    const billed = filteredPayments.reduce((sum, payment) => sum + getBillTotal(payment), 0);
    const collected = filteredPayments
      .filter((payment) => payment.status === 'paid' || payment.status === 'partial')
      .reduce((sum, payment) => sum + (payment.total_paid || 0), 0);
    const outstanding = Math.max(0, billed - collected);
    const paidCount = filteredPayments.filter((payment) => payment.status === 'paid').length;
    const pendingCount = filteredPayments.filter((payment) => payment.status === 'pending').length;
    const unpaidCount = filteredPayments.filter((payment) =>
      payment.status === 'unpaid' || payment.status === 'overdue' || payment.status === 'partial'
    ).length;
    const collectionRate = billed > 0 ? Math.round((collected / billed) * 100) : 0;

    return {
      billed,
      collected,
      outstanding,
      paidCount,
      pendingCount,
      unpaidCount,
      transactionCount: filteredPayments.length,
      collectionRate
    };
  }, [filteredPayments]);

  const categoryTotals = useMemo(() => {
    return [
      { label: 'Sewa Kamar', value: filteredPayments.reduce((sum, p) => sum + (p.amount_rent || 0), 0), color: 'bg-brand-teal' },
      { label: 'Listrik', value: filteredPayments.reduce((sum, p) => sum + (p.amount_electricity || 0), 0), color: 'bg-amber-500' },
      { label: 'Air', value: filteredPayments.reduce((sum, p) => sum + (p.amount_water || 0), 0), color: 'bg-sky-500' },
      { label: 'Lainnya', value: filteredPayments.reduce((sum, p) => sum + (p.amount_other || 0), 0), color: 'bg-indigo-500' }
    ];
  }, [filteredPayments]);

  const monthlyTrend = useMemo(() => {
    const selectedYear = filterYear === 'all' ? new Date().getFullYear() : Number(filterYear);
    return monthNames.map((month, index) => {
      const monthPayments = payments.filter((payment) => payment.period_year === selectedYear && payment.period_month === index + 1);
      const billed = monthPayments.reduce((sum, payment) => sum + getBillTotal(payment), 0);
      const collected = monthPayments
        .filter((payment) => payment.status === 'paid' || payment.status === 'partial')
        .reduce((sum, payment) => sum + (payment.total_paid || 0), 0);
      return {
        label: month.slice(0, 3),
        billed,
        collected
      };
    });
  }, [filterYear, payments]);

  const maxTrendValue = Math.max(...monthlyTrend.map((item) => Math.max(item.billed, item.collected)), 1);
  const maxCategoryValue = Math.max(...categoryTotals.map((item) => item.value), 1);
  const trendLimit = useMemo(() => getNiceLimit(maxTrendValue), [maxTrendValue]);
  const trendTicks = useMemo(() => {
    return [trendLimit, trendLimit * 0.75, trendLimit * 0.5, trendLimit * 0.25, 0];
  }, [trendLimit]);

  const topOutstanding = useMemo(() => {
    return filteredPayments
      .map((payment) => ({
        ...payment,
        outstanding: Math.max(0, getBillTotal(payment) - (payment.total_paid || 0))
      }))
      .filter((payment) => payment.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 5);
  }, [filteredPayments]);

  const getReportUrl = () => {
    const params = new URLSearchParams();
    if (filterMonth !== 'all') params.set('month', filterMonth);
    if (filterYear !== 'all') params.set('year', filterYear);
    const query = params.toString();
    return `/api/reports/financial.pdf${query ? `?${query}` : ''}`;
  };

  const fetchReportPdf = async () => apiBlob(getReportUrl());

  const previewReport = async () => {
    setIsPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await fetchReportPdf();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : 'Gagal membuka laporan PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const downloadReport = async () => {
    setIsPdfLoading(true);
    setPdfError(null);
    try {
      const blob = await fetchReportPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `laporan-keuangan-lapor-kos-${reportTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : 'Gagal mengunduh laporan PDF');
    } finally {
      setIsPdfLoading(false);
    }
  };

  const closePreview = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  const printPreview = () => {
    reportFrameRef.current?.contentWindow?.focus();
    reportFrameRef.current?.contentWindow?.print();
  };

  const openPdfInNewTab = () => {
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank', 'noopener,noreferrer');
  };

  const downloadPreview = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `laporan-keuangan-lapor-kos-${reportTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-brand-navy/40">
        <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
        <p className="font-bold text-sm uppercase tracking-widest">Menyusun Laporan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/40 rounded-[24px] p-8 text-center max-w-md shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-display font-bold text-brand-navy mb-2">Laporan gagal dimuat</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full animate-slide-up -mt-4 lg:-mt-8 pb-10 space-y-6">
      <div className="shrink-0 flex flex-col xl:flex-row xl:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-teal/10 text-brand-teal text-[11px] font-extrabold uppercase mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            Keuangan Kos
          </div>
          <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Laporan Keuangan</h1>
          <p className="text-[15px] text-gray-500 mt-1">Pantau arus tagihan, pembayaran, piutang, dan unduh surat laporan resmi.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={previewReport}
            disabled={isPdfLoading}
            className="h-12 px-4 rounded-[12px] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-brand-navy font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {isPdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Lihat / Cetak PDF
          </button>
          <button
            type="button"
            onClick={downloadReport}
            disabled={isPdfLoading}
            className="h-12 px-4 rounded-[12px] bg-[#0e8a7a] hover:bg-[#0c7567] text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-teal/10 transition-colors"
          >
            {isPdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="rounded-[16px] border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {pdfError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px] p-5 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-display font-bold text-brand-navy">Ringkasan {reportTitle}</h2>
              <p className="text-xs text-gray-500 mt-1">{summary.transactionCount} transaksi tercatat pada filter laporan.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative w-full sm:w-[170px]">
                <label className="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] text-gray-500 font-medium z-10">Bulan</label>
                <select
                  value={filterMonth}
                  onChange={(event) => setFilterMonth(event.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-bold text-brand-navy focus:outline-none focus:border-brand-teal appearance-none cursor-pointer"
                >
                  <option value="all">Semua Bulan</option>
                  {monthNames.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              <div className="relative w-full sm:w-[150px]">
                <label className="absolute -top-2 left-3 bg-white dark:bg-slate-900 px-1 text-[10px] text-gray-500 font-medium z-10">Tahun</label>
                <select
                  value={filterYear}
                  onChange={(event) => setFilterYear(event.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-bold text-brand-navy focus:outline-none focus:border-brand-teal appearance-none cursor-pointer"
                >
                  <option value="all">Semua Tahun</option>
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: 'Total Tagihan', value: formatCurrency(summary.billed), icon: ReceiptText, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
              { label: 'Terkumpul', value: formatCurrency(summary.collected), icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
              { label: 'Sisa Piutang', value: formatCurrency(summary.outstanding), icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-500/10' },
              { label: 'Rasio Bayar', value: `${summary.collectionRate}%`, icon: TrendingUp, color: 'text-brand-teal', bg: 'bg-teal-50 dark:bg-teal-500/10' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="border border-gray-200 dark:border-slate-800 rounded-[18px] p-4 bg-slate-50/60 dark:bg-slate-950/40">
                  <div className={`w-10 h-10 rounded-xl ${item.bg} ${item.color} flex items-center justify-center mb-4`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase">{item.label}</p>
                  <p className="text-lg font-display font-extrabold text-brand-navy mt-1 break-words">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-[16px] border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-500/10 p-4 text-center">
              <p className="text-2xl font-display font-extrabold text-emerald-600">{summary.paidCount}</p>
              <p className="text-[11px] font-bold text-emerald-700 uppercase mt-1">Lunas</p>
            </div>
            <div className="rounded-[16px] border border-amber-100 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-500/10 p-4 text-center">
              <p className="text-2xl font-display font-extrabold text-amber-600">{summary.pendingCount}</p>
              <p className="text-[11px] font-bold text-amber-700 uppercase mt-1">Menunggu</p>
            </div>
            <div className="rounded-[16px] border border-red-100 dark:border-red-900/40 bg-red-50/60 dark:bg-red-500/10 p-4 text-center">
              <p className="text-2xl font-display font-extrabold text-red-600">{summary.unpaidCount}</p>
              <p className="text-[11px] font-bold text-red-700 uppercase mt-1">Belum Selesai</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-brand-navy dark:bg-slate-900 text-white-fixed rounded-[24px] p-6 shadow-sm overflow-hidden relative">
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-brand-teal/20 text-brand-teal flex items-center justify-center mb-5">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-[11px] font-extrabold text-white-fixed/50 uppercase">Surat laporan</p>
            <h2 className="text-2xl font-display font-extrabold mt-2">Laporan siap diarsipkan</h2>
            <p className="text-sm text-white-fixed/60 mt-3 leading-6">
              Surat berisi rekap tagihan, pembayaran, piutang, rasio bayar, dan daftar transaksi sesuai filter periode.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white-fixed/5 border border-white-fixed/10 rounded-[14px] p-3">
                <p className="text-white-fixed/40 font-bold uppercase">Periode</p>
                <p className="font-extrabold mt-1">{reportTitle}</p>
              </div>
              <div className="bg-white-fixed/5 border border-white-fixed/10 rounded-[14px] p-3">
                <p className="text-white-fixed/40 font-bold uppercase">Pembuat</p>
                <p className="font-extrabold mt-1 truncate">{user?.name || 'Owner'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-display font-bold text-brand-navy">Tren Tahunan</h2>
              <p className="text-xs text-gray-500 mt-1">Perbandingan tagihan dan pembayaran per bulan.</p>
            </div>
            <CalendarDays className="w-5 h-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div className="h-52 flex flex-col justify-between py-1 text-right text-[10px] font-bold text-gray-400">
              {trendTicks.map((tick) => (
                <span key={tick}>{formatCompactCurrency(tick)}</span>
              ))}
            </div>
            <div className="relative h-52">
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                {trendTicks.map((tick) => (
                  <div key={tick} className="border-t border-dashed border-gray-200 dark:border-slate-800" />
                ))}
              </div>
              <div className="relative h-full flex items-end gap-2 sm:gap-3">
            {monthlyTrend.map((item) => {
              const billedHeight = Math.max(5, (item.billed / trendLimit) * 100);
              const collectedHeight = Math.max(5, (item.collected / trendLimit) * 100);
              return (
                <div key={item.label} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                  <div className="w-full h-full flex items-end justify-center gap-1">
                    <div title={`Tagihan ${formatCurrency(item.billed)}`} className="w-full max-w-4 bg-slate-200 dark:bg-slate-700 rounded-t-md" style={{ height: `${billedHeight}%` }} />
                    <div title={`Terkumpul ${formatCurrency(item.collected)}`} className="w-full max-w-4 bg-brand-teal rounded-t-md" style={{ height: `${collectedHeight}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-500 truncate">{item.label}</span>
                </div>
              );
            })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-5 mt-5 text-xs font-bold text-gray-500">
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-700" /> Tagihan</span>
            <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-brand-teal" /> Terkumpul</span>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-display font-bold text-brand-navy">Komposisi Tagihan</h2>
              <p className="text-xs text-gray-500 mt-1">Rincian nominal berdasarkan jenis biaya.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {categoryTotals.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs font-bold mb-2">
                  <span className="text-brand-navy">{item.label}</span>
                  <span className="text-gray-500">{formatCurrency(item.value)}</span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.max(3, (item.value / maxCategoryValue) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px] shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-brand-navy">Detail Transaksi</h2>
            <p className="text-xs text-gray-500 mt-1">Data pembayaran yang masuk ke periode laporan.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/60 text-[11px] uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-4 font-extrabold">Periode</th>
                  <th className="px-6 py-4 font-extrabold">Kamar / Penghuni</th>
                  <th className="px-6 py-4 font-extrabold">Status</th>
                  <th className="px-6 py-4 font-extrabold text-right">Tagihan</th>
                  <th className="px-6 py-4 font-extrabold text-right">Dibayar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-14 text-center text-gray-500">
                      Tidak ada transaksi pada periode ini.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.slice(0, 12).map((payment) => {
                    const totalBill = getBillTotal(payment);
                    const status = getStatusLabel(payment.status);
                    const isPaid = payment.status === 'paid';
                    const isPending = payment.status === 'pending';
                    return (
                      <tr key={payment.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-brand-navy">{monthNames[payment.period_month - 1]} {payment.period_year}</p>
                          <p className="text-xs text-gray-500 mt-1">Tempo {new Date(payment.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-brand-navy">Kamar {payment.contract?.room?.room_number || '-'}</p>
                          <p className="text-xs text-gray-500 mt-1">{payment.contract?.user?.name || '-'}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700'
                              : isPending
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                          }`}>
                            {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                            {status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-brand-navy">{formatCurrency(totalBill)}</td>
                        <td className="px-6 py-4 text-right font-bold text-brand-teal">{formatCurrency(payment.total_paid || 0)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-[24px] p-6 shadow-sm">
          <h2 className="text-lg font-display font-bold text-brand-navy">Piutang Terbesar</h2>
          <p className="text-xs text-gray-500 mt-1 mb-5">Prioritas transaksi yang perlu ditindaklanjuti.</p>
          <div className="space-y-3">
            {topOutstanding.length === 0 ? (
              <div className="border border-dashed border-gray-200 dark:border-slate-800 rounded-[18px] p-8 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-3" />
                <p className="text-sm font-bold text-brand-navy">Tidak ada piutang</p>
                <p className="text-xs text-gray-500 mt-1">Semua tagihan pada filter ini sudah aman.</p>
              </div>
            ) : (
              topOutstanding.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between gap-4 rounded-[16px] border border-gray-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-brand-navy truncate">Kamar {payment.contract?.room?.room_number || '-'}</p>
                    <p className="text-xs text-gray-500 mt-1 truncate">{payment.contract?.user?.name || '-'}</p>
                  </div>
                  <p className="text-sm font-extrabold text-amber-600 shrink-0">{formatCurrency(payment.outstanding)}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {pdfUrl && mounted && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) closePreview();
          }}
          className="fixed inset-0 z-[99999] bg-black/25 p-4 sm:p-6 lg:p-10 flex items-center justify-center"
        >
          <div className="relative w-full max-w-4xl h-[85vh] sm:h-[88vh] bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={closePreview}
              className="absolute top-3 right-3 z-30 h-9 w-9 rounded-full bg-white/90 hover:bg-white text-gray-700 border border-gray-200 shadow-md flex items-center justify-center transition-all hover:scale-105"
              aria-label="Tutup preview"
            >
              <X className="w-5 h-5" />
            </button>
            <iframe
              ref={reportFrameRef}
              src={pdfUrl}
              title="Preview Laporan Keuangan"
              className="w-full h-full border-none bg-slate-50"
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function getNiceLimit(value: number) {
  if (value <= 0) return 1000000;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function formatCompactCurrency(amount: number) {
  if (amount >= 1000000000) return `Rp ${(amount / 1000000000).toFixed(1).replace('.', ',')} M`;
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1).replace('.', ',')} jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)} rb`;
  return `Rp ${amount.toFixed(0)}`;
}
