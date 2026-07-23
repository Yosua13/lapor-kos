'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CreditCard, 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Eye, 
  X, 
  Calendar,
  DollarSign,
  Copy,
  Check,
  ChevronRight,
  Info,
  CheckSquare,
  Clock,
  ChevronDown,
  AlertCircle,
  ChevronLeft
} from 'lucide-react';
import { apiFetch, getImageUrl } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';

export default function PaymentsPage() {
  const { can } = useAuthorization();
  const canCreateBill = can(CAPABILITIES.PAYMENT_WRITE);
  const canVerifyPayment = can(CAPABILITIES.PAYMENT_VERIFY);
  const canExportPayment = can(CAPABILITIES.REPORT_EXPORT);
  const formatRupiah = (value: number | string) => {
    if (value === undefined || value === null) return '';
    const num = typeof value === 'string' ? parseInt(value.replace(/\D/g, '')) || 0 : value;
    if (num === 0) return '';
    return `Rp. ${num.toLocaleString('id-ID')}`;
  };

  const parseRupiah = (value: string) => {
    const clean = value.replace(/\D/g, '');
    return parseFloat(clean) || 0;
  };

  const [role, setRole] = useState<string>('');
  const [mounted, setMounted] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]); // For owner to create bill
  const [isLoading, setIsLoading] = useState(true);
  const [copiedText, setCopiedText] = useState(false);

  // Filters (Owner)
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Derived Pagination
  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const paginatedPayments = payments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Modals
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  // Forms
  const [newBill, setNewBill] = useState({
    contract_id: '',
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    amount_rent: 0,
    amount_electricity: 0,
    amount_water: 0,
    amount_other: 0,
    due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
    notes: ''
  });

  const [verifyForm, setVerifyForm] = useState({
    amount_rent: 0,
    amount_electricity: 0,
    amount_water: 0,
    amount_other: 0,
    total_paid: 0,
    status: 'paid',
    notes: ''
  });

  // Tenant Payment Form
  const [showPayModal, setShowPayModal] = useState(false);
  const [payStep, setPayStep] = useState(1);
  const [submitForm, setSubmitForm] = useState({
    payment_method: 'transfer',
    total_paid: 0,
    notes: '',
    file: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const userData = await apiFetch('/api/auth/me');
      setUser(userData);
      setRole(userData.role);

      if (userData.role === 'tenant') {
        const data = await apiFetch('/api/payments/my');
        setPayments(data || []);
      } else {
        const params: Record<string, string> = {};
        if (filterStatus) params.status = filterStatus;
        if (filterMonth) params.month = filterMonth;
        if (filterYear) params.year = filterYear;

        const [paymentsData, contractsData] = await Promise.all([
          apiFetch('/api/payments', { params }),
          apiFetch('/api/contracts')
        ]);
        setPayments(paymentsData || []);
        setContracts(contractsData || []);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    setCurrentPage(1);
    fetchPayments();
  }, [filterStatus, filterMonth, filterYear]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/payments', {
        method: 'POST',
        body: JSON.stringify(newBill)
      });
      setShowCreateBillModal(false);
      fetchPayments();
      // Reset form
      setNewBill({
        contract_id: '',
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
        amount_rent: 0,
        amount_electricity: 0,
        amount_water: 0,
        amount_other: 0,
        due_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 5).toISOString().split('T')[0],
        notes: ''
      });
    } catch (err: any) {
      alert('Gagal membuat tagihan: ' + err.message);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/payments/${selectedPayment.id}/verify`, {
        method: 'PUT',
        body: JSON.stringify(verifyForm)
      });
      setShowVerifyModal(false);
      fetchPayments();
    } catch (err: any) {
      alert('Gagal memverifikasi pembayaran: ' + err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSubmitForm({ ...submitForm, file: e.target.files[0] });
    }
  };

  const handleTenantPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitForm.file) {
      alert('Silakan unggah bukti transfer terlebih dahulu');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('proof', submitForm.file);
      formData.append('payment_method', submitForm.payment_method);
      formData.append('total_paid', submitForm.total_paid.toString());
      formData.append('notes', submitForm.notes);

      await apiFetch(`/api/payments/${selectedPayment.id}/submit`, {
        method: 'POST',
        body: formData
      });

      setShowPayModal(false);
      setPayStep(1);
      setSubmitForm({
        payment_method: 'transfer',
        total_paid: 0,
        notes: '',
        file: null
      });
      fetchPayments();
    } catch (err: any) {
      alert('Gagal mengirim bukti pembayaran: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openVerifyModal = (payment: any) => {
    setSelectedPayment(payment);
    setVerifyForm({
      amount_rent: payment.amount_rent,
      amount_electricity: payment.amount_electricity,
      amount_water: payment.amount_water,
      amount_other: payment.amount_other,
      total_paid: payment.total_paid || (payment.amount_rent + payment.amount_electricity + payment.amount_water + payment.amount_other),
      status: 'paid',
      notes: payment.notes || ''
    });
    setShowVerifyModal(true);
  };

  const openPayModal = (payment: any) => {
    setSelectedPayment(payment);
    const totalBill = payment.amount_rent + payment.amount_electricity + payment.amount_water + payment.amount_other - payment.total_paid;
    setSubmitForm({
      payment_method: 'transfer',
      total_paid: totalBill,
      notes: '',
      file: null
    });
    setPayStep(1);
    setShowPayModal(true);
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4 text-brand-navy/40">
        <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
        <p className="font-bold text-sm uppercase tracking-widest">Memuat Pembayaran...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full animate-slide-up -mt-4 lg:-mt-8">
      {/* HEADER */}
      <div className="shrink-0 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-display font-extrabold text-brand-navy">
            {role === 'tenant' ? 'Tagihan & Pembayaran Saya' : 'Manajemen Pembayaran'}
          </h1>
          <p className="text-[15px] text-gray-500 mt-1">
            {role === 'tenant' 
              ? 'Tinjau tagihan bulanan kos Anda dan laporkan pembayaran di sini.' 
              : 'Verifikasi bukti transfer penghuni kos dan kelola histori keuangan.'}
          </p>
        </div>
      </div>

      {/* TABS (Pills) for Owner */}
      {role !== 'tenant' && (
        <div className="flex flex-wrap items-center gap-3 mt-2 mb-6 shrink-0">
          <button
            onClick={() => setFilterStatus('')}
            className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
              filterStatus === '' 
                ? 'border-emerald-200 bg-emerald-50/50 text-[#0e8a7a]' 
                : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
            }`}
          >
            <CheckSquare className={`w-4 h-4 ${filterStatus === '' ? 'text-[#0e8a7a]' : 'text-emerald-500'}`} /> Semua 
          </button>
          
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
              filterStatus === 'pending' 
                ? 'border-amber-200 bg-amber-50 text-amber-600' 
                : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
            }`}
          >
            <Clock className={`w-4 h-4 ${filterStatus === 'pending' ? 'text-amber-500' : 'text-amber-500'}`} /> Menunggu Verifikasi
          </button>

          <button
            onClick={() => setFilterStatus('paid')}
            className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
              filterStatus === 'paid' 
                ? 'border-emerald-200 bg-emerald-50/50 text-[#0e8a7a]' 
                : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 className={`w-4 h-4 ${filterStatus === 'paid' ? 'text-emerald-500' : 'text-emerald-500'}`} /> Lunas
          </button>

          <button
            onClick={() => setFilterStatus('unpaid')}
            className={`px-4 py-2 rounded-[10px] border text-[13px] font-bold flex items-center gap-2 transition-all ${
              filterStatus === 'unpaid' 
                ? 'border-red-200 bg-red-50 text-red-600' 
                : 'border-gray-200 bg-white text-[#1f2937] hover:bg-gray-50'
            }`}
          >
            <AlertCircle className={`w-4 h-4 ${filterStatus === 'unpaid' ? 'text-red-500' : 'text-red-500'}`} /> Belum Bayar
          </button>
        </div>
      )}

      {/* MAIN WHITE CARD CONTAINER */}
      <div className="flex-1 bg-white rounded-[24px] border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        
        {/* TOOLBAR */}
        <div className="shrink-0 flex flex-col lg:flex-row items-center justify-between gap-4 p-6 lg:px-8 border-b border-gray-100">
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto flex-1">
            {role !== 'tenant' && (
              <>
                {/* Month Dropdown */}
                <div className="relative w-full sm:w-[150px]">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Bulan</label>
                  <select 
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
                  >
                    <option value="">Semua Bulan</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i+1} value={i+1}>Bulan {i+1}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>

                {/* Year Dropdown */}
                <div className="relative w-full sm:w-[150px]">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-[10px] text-gray-500 font-medium z-10">Tahun</label>
                  <select 
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-8 py-2.5 text-[13px] font-medium text-[#1f2937] focus:outline-none focus:border-[#0e8a7a] transition-colors appearance-none relative cursor-pointer"
                  >
                    <option value="">Semua Tahun</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto shrink-0 justify-end">
            {canExportPayment && (
              <button className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-200 text-[#1f2937] font-bold text-[13px] rounded-[10px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shadow-sm bg-white">
                <Download className="w-4 h-4" /> Export Data
              </button>
            )}
            {canCreateBill && (
              <button
                type="button"
                onClick={() => setShowCreateBillModal(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0e8a7a] hover:bg-[#0c7567] text-white font-bold text-[13px] rounded-[10px] transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Buat Tagihan
              </button>
            )}
          </div>
        </div>

        {/* CONTENT VIEW */}
        <div className={`flex-1 overflow-y-auto no-scrollbar px-6 lg:px-8 pb-6 ${
          paginatedPayments.length > 0 ? 'bg-slate-50 pt-0' : 'bg-white pt-6'
        }`}>
          {paginatedPayments.length === 0 ? (
            <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-[20px] p-12 text-center bg-white">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-400">
                <CreditCard className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-brand-navy mb-1">Tidak ada transaksi</h3>
              <p className="text-sm text-gray-500 max-w-sm mx-auto">Data pembayaran tidak ditemukan berdasarkan filter bulan/tahun.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-separate border-spacing-y-4 min-w-[1000px]">
              <thead className="sticky top-0 bg-slate-50 z-20">
                <tr className="text-[13px] font-bold text-gray-500 tracking-wide">
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Periode</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">{role === 'tenant' ? 'Metode' : 'Kamar / Penghuni'}</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200">Status</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200 text-right">Total Tagihan</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200 text-right">Dibayar</th>
                  <th className="font-bold px-6 pb-3 pt-6 border-b border-gray-200 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((p) => {
                  const totalBill = p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
                  const roomNum = p.contract?.room?.room_number || '-';
                  const tenantName = p.contract?.user?.name || '-';
                  const isPaid = p.status === 'paid';
                  const isPending = p.status === 'pending';
                  const isUnpaid = p.status === 'unpaid' || p.status === 'overdue';
                  const isPartial = p.status === 'partial';
                  
                  return (
                    <tr key={p.id} className="bg-white group relative">
                      <td 
                        className="px-6 py-5 rounded-l-[16px] border-y border-l border-gray-200 align-middle bg-white"
                      >
                        <p className="font-bold text-brand-navy text-[15px]">Bulan {p.period_month} - {p.period_year}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5">Tempo: {new Date(p.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                      </td>

                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white">
                        {role === 'tenant' ? (
                          <span className="font-bold uppercase text-gray-600 text-[14px]">{p.payment_method || '-'}</span>
                        ) : (
                          <div>
                            <p className="font-bold text-brand-navy text-[14px]">Kamar {roomNum}</p>
                            <p className="text-[13px] text-gray-500 mt-0.5">{tenantName}</p>
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isPaid 
                            ? 'bg-teal-50 text-[#0e8a7a]' 
                            : isPending
                            ? 'bg-amber-50 text-amber-600'
                            : isPartial
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-red-50 text-red-600'
                        }`}>
                          {isPaid && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {isPending && <Clock className="w-3.5 h-3.5" />}
                          {isPartial && <CheckSquare className="w-3.5 h-3.5" />}
                          {isUnpaid && <AlertCircle className="w-3.5 h-3.5" />}
                          {isPaid ? 'LUNAS' : isPending ? 'MENUNGGU VERIFIKASI' : isPartial ? 'SEBAGIAN' : 'BELUM BAYAR'}
                        </span>
                      </td>

                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white text-right font-bold text-[14px] text-brand-navy">
                        Rp {totalBill.toLocaleString('id-ID')}
                      </td>

                      <td className="px-6 py-5 border-y border-gray-200 align-middle bg-white text-right font-bold text-[14px] text-[#0e8a7a]">
                        Rp {p.total_paid.toLocaleString('id-ID')}
                      </td>

                      <td className="px-6 py-5 rounded-r-[16px] border-y border-r border-gray-200 align-middle text-right bg-white">
                        <div className="flex items-center justify-end gap-2.5 relative">
                          {role === 'tenant' && (isUnpaid || isPartial) && (
                            <button 
                              onClick={() => openPayModal(p)}
                              className="px-3.5 py-2 text-[11px] font-bold text-white bg-[#0e8a7a] hover:bg-[#0c7567] rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm"
                            >
                              Bayar
                            </button>
                          )}
                          {canVerifyPayment && isPending && (
                            <button 
                              onClick={() => openVerifyModal(p)}
                              className="px-3.5 py-2 text-[11px] font-bold text-amber-600 border border-amber-500 hover:bg-amber-50 rounded-xl transition-colors inline-flex items-center gap-1 shadow-sm bg-white"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Verifikasi
                            </button>
                          )}
                          {role !== 'tenant' && !isPending && (
                            <button 
                              onClick={() => openVerifyModal(p)}
                              className="px-3.5 py-2 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Lihat
                            </button>
                          )}
                          {isPaid && (
                            <button 
                              onClick={() => setSelectedReceipt(p)}
                              className="px-3.5 py-2 text-[11px] font-bold text-[#0e8a7a] bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors inline-flex items-center gap-1"
                              title="Lihat Kwitansi"
                            >
                              <FileText className="w-3.5 h-3.5" /> Kwitansi
                            </button>
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
              Menampilkan {payments.length > 0 ? Math.min((currentPage - 1) * itemsPerPage + 1, payments.length) : 0} - {Math.min(currentPage * itemsPerPage, payments.length)} dari {payments.length} transaksi
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
              disabled={currentPage === 1 || payments.length === 0}
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
              disabled={currentPage === totalPages || payments.length === 0}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors bg-white"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Create Bill (Owner Only) */}
      {showCreateBillModal && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(11, 31, 53, 0.45)'
          }}
        >
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl relative animate-slide-up">
            <button 
              onClick={() => setShowCreateBillModal(false)}
              className="absolute top-6 right-6 text-brand-navy/30 hover:text-brand-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-display font-bold text-brand-navy mb-2">Buat Tagihan Baru</h3>
            <p className="text-xs text-brand-navy/40 mb-6">Tambahkan detail biaya utilitas dan sewa bulanan untuk kamar tertentu</p>

            <form onSubmit={handleCreateBill} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Pilih Kamar / Kontrak Aktif</label>
                <select 
                  required
                  value={newBill.contract_id} 
                  onChange={(e) => {
                    const cId = e.target.value;
                    const contract = contracts.find(c => c.id === cId);
                    setNewBill({ 
                      ...newBill, 
                      contract_id: cId,
                      amount_rent: contract ? (contract.payment_interval === 'per_contract' ? contract.monthly_rent * contract.rental_duration : contract.monthly_rent) : 0
                    });
                  }}
                  className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white focus:border-brand-teal/20 transition-all font-semibold"
                >
                  <option value="">Pilih Kamar...</option>
                  {contracts.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>Kamar {c.room?.room_number || '-'} - {c.user?.name || '-'}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Periode Bulan</label>
                  <select 
                    value={newBill.period_month} 
                    onChange={(e) => setNewBill({ ...newBill, period_month: parseInt(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i+1} value={i+1}>Bulan {i+1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Periode Tahun</label>
                  <select 
                    value={newBill.period_year} 
                    onChange={(e) => setNewBill({ ...newBill, period_year: parseInt(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                  >
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Tagihan Sewa (Rp)</label>
                  <input 
                    type="text" 
                    value={formatRupiah(newBill.amount_rent)} 
                    onChange={(e) => setNewBill({ ...newBill, amount_rent: parseRupiah(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                    placeholder="Sewa kamar"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Tagihan Listrik (Rp)</label>
                  <input 
                    type="text" 
                    value={formatRupiah(newBill.amount_electricity)} 
                    onChange={(e) => setNewBill({ ...newBill, amount_electricity: parseRupiah(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                    placeholder="Biaya listrik"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Tagihan Air (Rp)</label>
                  <input 
                    type="text" 
                    value={formatRupiah(newBill.amount_water)} 
                    onChange={(e) => setNewBill({ ...newBill, amount_water: parseRupiah(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                    placeholder="Biaya air"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Biaya Lainnya (Rp)</label>
                  <input 
                    type="text" 
                    value={formatRupiah(newBill.amount_other)} 
                    onChange={(e) => setNewBill({ ...newBill, amount_other: parseRupiah(e.target.value) })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                    placeholder="Biaya tambahan"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Tanggal Jatuh Tempo</label>
                  <input 
                    type="date" 
                    required
                    value={newBill.due_date} 
                    onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Catatan Tambahan</label>
                  <textarea 
                    value={newBill.notes} 
                    onChange={(e) => setNewBill({ ...newBill, notes: e.target.value })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white transition-all font-semibold h-20"
                    placeholder="Contoh: Pembayaran air periode 1-30 Mei"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full mt-6 py-4 bg-brand-teal hover:bg-brand-teal-light text-white rounded-2xl font-bold transition-all shadow-lg shadow-brand-teal/20"
              >
                Buat Tagihan
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Verify Payment (Owner Only) */}
      {showVerifyModal && selectedPayment && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(11, 31, 53, 0.45)'
          }}
        >
          <div className="bg-white rounded-[32px] w-full max-w-3xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-slide-up">
            <button 
              onClick={() => setShowVerifyModal(false)}
              className="absolute top-6 right-6 text-brand-navy/30 hover:text-brand-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-display font-bold text-brand-navy mb-2">Verifikasi Bukti Pembayaran</h3>
            <p className="text-xs text-brand-navy/40 mb-6">Tinjau foto bukti transfer yang dikirim oleh penghuni kos</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
              {/* Photo Proof */}
              <div className="bg-brand-navy/5 rounded-3xl border border-brand-navy/5 p-4 flex items-center justify-center min-h-[300px]">
                {selectedPayment.proof_photo_url ? (
                  <a href={getImageUrl(selectedPayment.proof_photo_url)} target="_blank" rel="noopener noreferrer">
                    <img 
                      src={getImageUrl(selectedPayment.proof_photo_url)} 
                      alt="Bukti Transfer" 
                      className="max-h-[350px] rounded-2xl object-contain shadow-lg"
                    />
                  </a>
                ) : (
                  <div className="text-center text-brand-navy/30">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Belum Ada Unggahan Foto Bukti</p>
                  </div>
                )}
              </div>

              {/* Verify Form Details */}
              <form onSubmit={handleVerifySubmit} className="space-y-4">
                <div className="bg-brand-navy/5 p-5 rounded-2xl border border-brand-navy/5 text-sm space-y-2">
                  <div className="flex justify-between"><span className="text-brand-navy/40 font-semibold">Kamar / Penghuni:</span><span className="font-bold">Kamar {selectedPayment.contract?.room?.room_number || '-'} - {selectedPayment.contract?.user?.name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-brand-navy/40 font-semibold">Total Tagihan:</span><span className="font-bold text-brand-navy">Rp {(selectedPayment.amount_rent + selectedPayment.amount_electricity + selectedPayment.amount_water + selectedPayment.amount_other).toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span className="text-brand-navy/40 font-semibold">Metode Dipilih:</span><span className="font-bold text-brand-teal uppercase">{selectedPayment.payment_method || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-brand-navy/40 font-semibold">Klaim Pembayaran:</span><span className="font-bold text-brand-teal">Rp {selectedPayment.total_paid.toLocaleString('id-ID')}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Jumlah Dibayar (Rp)</label>
                    <input 
                      type="text" 
                      required
                      disabled
                      value={formatRupiah(verifyForm.total_paid)} 
                      onChange={(e) => setVerifyForm({ ...verifyForm, total_paid: parseRupiah(e.target.value) })}
                      className="w-full bg-gray-100 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm font-semibold opacity-60 cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Status Pembayaran</label>
                    <select 
                      value={verifyForm.status} 
                      onChange={(e) => setVerifyForm({ ...verifyForm, status: e.target.value })}
                      className="w-full bg-white border border-brand-navy/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-brand-teal/20 transition-all font-semibold text-brand-navy cursor-pointer"
                    >
                      <option value="paid">Lunas (Paid)</option>
                      <option value="partial">Bayar Sebagian (Partial)</option>
                      <option value="unpaid">Ditolak / Belum Bayar (Unpaid)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Catatan Pembayaran (Penghuni)</label>
                  <textarea 
                    value={verifyForm.notes} 
                    disabled
                    className="w-full bg-gray-100 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm font-semibold h-20 opacity-60 cursor-not-allowed resize-none"
                    placeholder="Tidak ada catatan tambahan dari penghuni"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full mt-6 py-4 bg-brand-teal hover:bg-brand-teal-light text-white rounded-2xl font-bold transition-all shadow-lg shadow-brand-teal/20"
                >
                  Simpan Verifikasi
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal: Tenant Upload Payment (Tenant Only) */}
      {showPayModal && selectedPayment && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300"
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(11, 31, 53, 0.45)'
          }}
        >
          <div className="bg-white rounded-[32px] w-full max-w-xl p-8 shadow-2xl relative animate-slide-up">
            <button 
              onClick={() => setShowPayModal(false)}
              className="absolute top-6 right-6 text-brand-navy/30 hover:text-brand-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-display font-bold text-brand-navy mb-1">Kirim Laporan Pembayaran</h3>
            <p className="text-xs text-brand-navy/40 mb-6">Ikuti langkah-langkah di bawah untuk melunasi tagihan Anda</p>

            {/* Stepper Header */}
            <div className="flex items-center gap-4 mb-8">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${payStep >= 1 ? 'bg-brand-teal text-white' : 'bg-brand-navy/5 text-brand-navy/40'}`}>1</div>
              <div className="flex-1 h-0.5 bg-brand-navy/10" />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${payStep >= 2 ? 'bg-brand-teal text-white' : 'bg-brand-navy/5 text-brand-navy/40'}`}>2</div>
            </div>

            {payStep === 1 ? (
              <div className="space-y-6">
                <div className="bg-brand-teal/5 border border-brand-teal/10 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between text-xs text-brand-navy/40"><span className="font-semibold">Nama Properti:</span><span className="font-bold">Lapor Kos</span></div>
                  <div className="flex justify-between text-xs text-brand-navy/40"><span className="font-semibold">Nominal Tagihan:</span><span className="font-bold">Rp {(selectedPayment.amount_rent + selectedPayment.amount_electricity + selectedPayment.amount_water + selectedPayment.amount_other).toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between text-xs text-brand-navy/40"><span className="font-semibold">Bulan Tagihan:</span><span className="font-bold">Bulan {selectedPayment.period_month} - {selectedPayment.period_year}</span></div>
                </div>

                <div className="bg-brand-navy/5 rounded-3xl p-6 border border-brand-navy/5 space-y-4">
                  <h4 className="text-xs font-bold text-brand-navy/50 tracking-wider">REKENING BANK BRI RESMI</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-display font-bold text-brand-navy">459801035222531</p>
                      <p className="text-xs text-brand-navy/40">a/n Pemilik Properti Kos</p>
                    </div>
                    <button 
                      onClick={() => copyToClipboard("459801035222531")}
                      className="p-2.5 bg-white border border-brand-navy/10 rounded-xl hover:bg-brand-cream transition-colors text-brand-navy/50 hover:text-brand-teal flex items-center justify-center"
                    >
                      {copiedText ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 flex items-start gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Transfer nominal pembayaran ke rekening di atas, simpan struk transfer Anda, lalu klik tombol **Lanjutkan** untuk mengunggah bukti bayar.</p>
                </div>

                <button 
                  onClick={() => setPayStep(2)}
                  className="w-full py-4 bg-brand-teal hover:bg-brand-teal-light text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Lanjutkan</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            ) : (
              <form onSubmit={handleTenantPaySubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Metode Pembayaran</label>
                    <select 
                      value={submitForm.payment_method} 
                      onChange={(e) => setSubmitForm({ ...submitForm, payment_method: e.target.value })}
                      className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white font-semibold text-brand-navy"
                    >
                      <option value="transfer">Transfer Bank (BCA)</option>
                      <option value="ovo">OVO</option>
                      <option value="gopay">GoPay</option>
                      <option value="qris">QRIS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Nominal Transfer (Rp)</label>
                    <input 
                      type="text" 
                      required
                      value={formatRupiah(submitForm.total_paid)} 
                      onChange={(e) => setSubmitForm({ ...submitForm, total_paid: parseRupiah(e.target.value) })}
                      className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Unggah Foto Bukti Transfer</label>
                  <div className="border-2 border-dashed border-brand-navy/10 rounded-2xl p-6 text-center hover:border-brand-teal transition-colors relative cursor-pointer min-h-[160px] flex flex-col items-center justify-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    {submitForm.file ? (
                      <img 
                        src={URL.createObjectURL(submitForm.file)} 
                        alt="Preview" 
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl" 
                      />
                    ) : (
                      <>
                        <Upload className="w-10 h-10 mx-auto text-brand-navy/20 mb-2" />
                        <p className="text-xs font-bold text-brand-navy/60">Pilih Foto / Ambil Gambar dari Kamera</p>
                        <p className="text-[10px] text-brand-navy/30 mt-1">Format gambar: JPG, PNG, GIF</p>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-navy/40 uppercase tracking-widest mb-1.5">Catatan Tambahan (Opsional)</label>
                  <textarea 
                    value={submitForm.notes} 
                    onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })}
                    className="w-full bg-brand-navy/5 border border-brand-navy/5 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white font-semibold h-20"
                    placeholder="Catatan transfer (contoh: Pembayaran lunas air & sewa)"
                  />
                </div>

                <div className="flex gap-4 mt-6">
                  <button 
                    type="button" 
                    onClick={() => setPayStep(1)}
                    className="w-1/3 py-4 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy rounded-2xl font-bold transition-all"
                  >
                    Kembali
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-2/3 py-4 bg-brand-teal hover:bg-brand-teal-light text-white rounded-2xl font-bold transition-all shadow-lg shadow-brand-teal/20 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Kirim Pembayaran</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

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
