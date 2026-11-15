'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Loader2,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch, getImageUrl } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import type {
  Payment,
  PaymentProof,
  PaymentReceipt,
  PaymentStatus,
  ReconciliationReport,
  VerifyPaymentPayload,
} from '@/features/payments/types';
import {
  clearStoredSnapSession,
  createPaymentBill,
  ensureSnapScriptLoaded,
  getPayment,
  getReceipt,
  getReceiptHTML,
  getReconciliationReport,
  getSnapToken,
  getStoredSnapSession,
  listPayments,
  saveSnapSession,
  submitPaymentProof,
  syncMidtransStatus,
  syncSnapCallback,
  verifyPayment,
} from '@/features/payments/api';
import {
  formatDate,
  formatMoney,
  formatPeriod,
  paymentStatusLabel,
  paymentStatusTone,
  refundStatusLabel,
  refundStatusTone,
} from '@/features/payments/format';

type Tab = 'payments' | 'reconciliation';

export default function PaymentsPage() {
  const { can, isTenant } = useAuthorization();
  const { activeProperty } = useActiveProperty();

  const canCreateBill = can(CAPABILITIES.PAYMENT_WRITE);
  const canVerifyPayment = can(CAPABILITIES.PAYMENT_VERIFY);
  const canReadPayment = can(CAPABILITIES.PAYMENT_READ);

  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Modals
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

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
    notes: '',
  });

  const [verifyForm, setVerifyForm] = useState<VerifyPaymentPayload>({
    status: 'paid',
    paid_amount_minor: 0,
    notes: '',
    rejection_reason: '',
    credit_overpayment: true,
  });

  const [tenantPayForm, setTenantPayForm] = useState({
    payment_method: 'transfer',
    total_paid: 0,
    notes: '',
    file: null as File | null,
  });
  const [tenantPaymentMode, setTenantPaymentMode] = useState<'midtrans' | 'manual'>('midtrans');
  const [snapLoading, setSnapLoading] = useState(false);
  const [hasSavedSnapSession, setHasSavedSnapSession] = useState(false);
  const [activeSnapPoll, setActiveSnapPoll] = useState<{
    paymentId: string;
    orderId: string;
  } | null>(null);

  // Reconciliation state
  const [reconcileReport, setReconcileReport] = useState<ReconciliationReport | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileStartDate, setReconcileStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [reconcileEndDate, setReconcileEndDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Fetch Payments
  const fetchPayments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;

      const data = await listPayments(isTenant, params);
      setPayments(data || []);

      if (!isTenant && canCreateBill) {
        try {
          const contractsData = await apiFetch<any[]>('/api/contracts', { propertyScoped: true });
          setContracts(contractsData || []);
        } catch {
          // ignore contracts fetch error
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data pembayaran.');
    } finally {
      setIsLoading(false);
    }
  }, [isTenant, filterStatus, filterMonth, filterYear, canCreateBill]);

  // Fetch Reconciliation Report
  const fetchReconciliation = useCallback(async () => {
    if (isTenant) return;
    setReconcileLoading(true);
    try {
      const data = await getReconciliationReport(reconcileStartDate, reconcileEndDate);
      setReconcileReport(data);
    } catch (err) {
      console.error('Failed to load reconciliation:', err);
    } finally {
      setReconcileLoading(false);
    }
  }, [isTenant, reconcileStartDate, reconcileEndDate]);

  useEffect(() => {
    void fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (activeTab === 'reconciliation') {
      void fetchReconciliation();
    }
  }, [activeTab, fetchReconciliation]);

  // Derived Pagination
  const totalPages = Math.ceil(payments.length / itemsPerPage);
  const paginatedPayments = payments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Open Verify Modal
  const handleOpenVerify = async (p: Payment) => {
    setSelectedPayment(p);
    // Reload full payment details including proofs
    try {
      const full = await getPayment(p.id, isTenant);
      setSelectedPayment(full);
      const totalBill = full.amount_rent + full.amount_electricity + full.amount_water + full.amount_other;
      const amountToVerify = full.paid_amount_minor > 0
        ? full.paid_amount_minor
        : full.total_paid > 0
        ? full.total_paid
        : totalBill;

      setVerifyForm({
        status: 'paid',
        paid_amount_minor: Math.round(amountToVerify),
        notes: full.notes || '',
        rejection_reason: '',
        credit_overpayment: true,
      });
    } catch {
      setVerifyForm({
        status: 'paid',
        paid_amount_minor: Math.round(p.total_paid || p.amount_rent),
        notes: p.notes || '',
        rejection_reason: '',
        credit_overpayment: true,
      });
    }
    setShowVerifyModal(true);
  };

  // Submit Verification
  const handleSubmitVerify = async () => {
    if (!selectedPayment) return;
    if (verifyForm.status === 'rejected' && !verifyForm.rejection_reason?.trim()) {
      setError('Alasan penolakan wajib diisi bila status pembayaran ditolak.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await verifyPayment(selectedPayment.id, verifyForm);
      setNotice(
        verifyForm.status === 'rejected'
          ? 'Pembayaran berhasil ditandai ditolak.'
          : 'Pembayaran berhasil diverifikasi dan kwitansi resmi telah diterbitkan.',
      );
      setShowVerifyModal(false);
      void fetchPayments();
      if (activeTab === 'reconciliation') void fetchReconciliation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memverifikasi pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  // Open Pay Modal (Tenant)
  const handleOpenPay = (p: Payment) => {
    setSelectedPayment(p);
    const grossAmount =
      p.amount_minor || p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
    const totalBill = p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other - p.total_paid;
    setTenantPayForm({
      payment_method: 'transfer',
      total_paid: totalBill > 0 ? totalBill : p.amount_rent,
      notes: '',
      file: null,
    });
    let storedSession = getStoredSnapSession(p.id, grossAmount);
    // If the payment in DB is unpaid or has a manual proof, clear any stale Midtrans session
    const isManualPending =
      p.status === 'pending' &&
      (p.provider !== 'midtrans' || Boolean(p.proof_photo_url) || Boolean(p.proofs && p.proofs.length > 0));
    if ((p.status === 'unpaid' && !p.provider_ref && storedSession?.method_selected) || isManualPending) {
      clearStoredSnapSession(p.id);
      storedSession = null;
    }
    const alreadySelectedMethod =
      (p.status === 'pending' && p.provider === 'midtrans' && !p.proof_photo_url) ||
      Boolean(storedSession?.method_selected && p.status !== 'unpaid' && !isManualPending);
    setHasSavedSnapSession(alreadySelectedMethod);
    setTenantPaymentMode(
      p.status !== 'paid' && p.status !== 'partial' && !isManualPending ? 'midtrans' : 'manual',
    );
    setShowPayModal(true);
  };

  // Automatic background status sync with Midtrans Core API every 4 seconds
  // while a Snap session is active or a Midtrans bill is in 'pending' status (no need to click "Check Status").
  useEffect(() => {
    if (!isTenant) return;

    const pendingPayment = payments.find(
      (p) =>
        p.status === 'pending' &&
        p.provider === 'midtrans' &&
        !p.proof_photo_url,
    );
    const targetPaymentId = activeSnapPoll?.paymentId || pendingPayment?.id;
    if (!targetPaymentId) return;

    const stored = getStoredSnapSession(targetPaymentId);
    const targetOrderId =
      activeSnapPoll?.orderId || stored?.order_id || pendingPayment?.provider_ref || '';

    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const res = await syncMidtransStatus(targetPaymentId, targetOrderId);
        if (cancelled) return;
        if (res.payment_status === 'paid') {
          clearStoredSnapSession(targetPaymentId);
          setHasSavedSnapSession(false);
          setActiveSnapPoll(null);
          if (typeof window !== 'undefined' && window.snap?.hide) {
            try {
              window.snap.hide();
            } catch {
              // ignore if popup already closed
            }
          }
          setNotice(
            'Pembayaran via Midtrans berhasil! Status tagihan otomatis Lunas dan kwitansi digital resmi telah diterbitkan.',
          );
          await fetchPayments();
          if (res.payment) {
            void handleOpenReceipt(res.payment);
          }
        } else if (res.midtrans_status === 'pending' || res.payment_status === 'pending') {
          if (stored && !stored.method_selected) {
            saveSnapSession(targetPaymentId, stored.gross_amount, stored, true);
          }
          setHasSavedSnapSession(true);
        }
      } catch {
        // Ignore transient polling errors
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isTenant, activeSnapPoll, payments, fetchPayments]);

  // Pay Online via Midtrans Snap (Tenant)
  // forceNew = false -> Resume existing Snap token (opens at last payment screen until completed)
  // forceNew = true  -> Cancel previous method on Midtrans & generate a fresh Snap token (opens method selection list)
  const handlePayWithMidtrans = async (forceNew = false) => {
    if (!selectedPayment) return;
    setSnapLoading(true);
    setError(null);
    try {
      const grossAmount =
        selectedPayment.amount_minor ||
        selectedPayment.amount_rent +
          selectedPayment.amount_electricity +
          selectedPayment.amount_water +
          selectedPayment.amount_other;

      const existingSession = getStoredSnapSession(selectedPayment.id, grossAmount);
      let snapData = !forceNew ? existingSession : null;
      if (!snapData) {
        const previousOrderId =
          existingSession?.order_id || selectedPayment.provider_ref || undefined;
        if (forceNew) {
          clearStoredSnapSession(selectedPayment.id);
        }
        snapData = await getSnapToken(selectedPayment.id, {
          forceNew,
          previousOrderId,
        });
        saveSnapSession(
          selectedPayment.id,
          grossAmount,
          snapData,
          !forceNew && selectedPayment.status === 'pending',
        );
      }

      setActiveSnapPoll({
        paymentId: selectedPayment.id,
        orderId: snapData.order_id,
      });

      await ensureSnapScriptLoaded(snapData.client_key);

      if (typeof window !== 'undefined' && window.snap && typeof window.snap.pay === 'function') {
        setShowPayModal(false);
        window.snap.pay(snapData.token, {
          onSuccess: async (result) => {
            clearStoredSnapSession(selectedPayment.id);
            setHasSavedSnapSession(false);
            setActiveSnapPoll(null);
            let updatedPayment = selectedPayment;
            try {
              const synced = await syncSnapCallback(selectedPayment.id, {
                ...result,
                order_id: result?.order_id || snapData.order_id,
                transaction_status: result?.transaction_status || 'settlement',
              });
              if (synced?.payment) {
                updatedPayment = synced.payment;
              }
            } catch {
              // Webhook or auto-sync may have already processed it
            }
            setNotice(
              'Pembayaran via Midtrans berhasil! Status tagihan otomatis Lunas dan kwitansi digital resmi telah diterbitkan.',
            );
            await fetchPayments();
            void handleOpenReceipt(updatedPayment);
          },
          onPending: async (result) => {
            saveSnapSession(selectedPayment.id, grossAmount, snapData, true);
            setHasSavedSnapSession(true);
            try {
              await syncSnapCallback(selectedPayment.id, {
                ...result,
                order_id: result?.order_id || snapData.order_id,
                transaction_status: result?.transaction_status || 'pending',
              });
            } catch {
              // Ignore sync error on pending
            }
            setNotice(
              'Instruksi pembayaran berhasil dibuat. Status akan otomatis menjadi Lunas segera setelah Anda membayar di Simulator Midtrans.',
            );
            await fetchPayments();
          },
          onError: () => {
            clearStoredSnapSession(selectedPayment.id);
            setHasSavedSnapSession(false);
            setActiveSnapPoll(null);
            setError(
              'Transaksi pembayaran Midtrans gagal diproses. Silakan coba lagi atau gunakan metode Transfer Manual.',
            );
          },
          onClose: async () => {
            try {
              const syncRes = await syncMidtransStatus(selectedPayment.id, snapData.order_id);
              if (syncRes.payment_status === 'paid') {
                clearStoredSnapSession(selectedPayment.id);
                setHasSavedSnapSession(false);
                setActiveSnapPoll(null);
                setNotice(
                  'Pembayaran via Midtrans berhasil! Status tagihan otomatis Lunas dan kwitansi digital resmi telah diterbitkan.',
                );
                await fetchPayments();
                if (syncRes.payment) {
                  void handleOpenReceipt(syncRes.payment);
                }
                return;
              }
              if (syncRes.midtrans_status === 'pending' || syncRes.payment_status === 'pending') {
                saveSnapSession(selectedPayment.id, grossAmount, snapData, true);
                setHasSavedSnapSession(true);
                await fetchPayments();
                setNotice(
                  'Jendela pembayaran ditutup. Klik Bayar -> Lanjutkan Pembayaran untuk kembali ke halaman terakhir, atau Ganti Metode Pembayaran untuk memilih metode lain.',
                );
                return;
              }
              // User closed the popup before choosing any payment method
              setHasSavedSnapSession(false);
              setActiveSnapPoll(null);
              setNotice('Jendela pembayaran Midtrans ditutup.');
            } catch {
              setNotice('Jendela pembayaran Midtrans ditutup.');
            }
          },
        });
      } else if (snapData.redirect_url) {
        window.open(snapData.redirect_url, '_blank', 'noopener,noreferrer');
        setShowPayModal(false);
        setNotice('Halaman pembayaran Midtrans dibuka di tab baru.');
      } else {
        throw new Error('Midtrans Snap SDK belum siap di browser Anda.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memulai pembayaran online Midtrans.');
    } finally {
      setSnapLoading(false);
    }
  };

  // Submit Tenant Pay Form
  const handleSubmitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    if (!tenantPayForm.file) {
      setError('Silakan pilih dan unggah file bukti transfer/pembayaran.');
      return;
    }
    if (tenantPayForm.total_paid <= 0) {
      setError('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('proof', tenantPayForm.file);
      formData.append('payment_method', tenantPayForm.payment_method);
      formData.append('total_paid', tenantPayForm.total_paid.toString());
      formData.append('notes', tenantPayForm.notes);

      await submitPaymentProof(selectedPayment.id, formData);
      clearStoredSnapSession(selectedPayment.id);
      setHasSavedSnapSession(false);
      setActiveSnapPoll(null);
      setNotice('Bukti pembayaran berhasil dikirim. Menunggu verifikasi pemilik kos.');
      setShowPayModal(false);
      void fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim bukti pembayaran.');
    } finally {
      setBusy(false);
    }
  };

  // Create Bill (Staff)
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBill.contract_id) {
      setError('Silakan pilih kontrak penyewa.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPaymentBill(newBill);
      setNotice('Tagihan pembayaran berhasil dibuat.');
      setShowCreateBillModal(false);
      void fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat tagihan.');
    } finally {
      setBusy(false);
    }
  };

  // Open Receipt Modal
  const handleOpenReceipt = async (p: Payment) => {
    setSelectedPayment(p);
    setSelectedReceipt(p.receipt || null);
    setReceiptLoading(true);
    setShowReceiptModal(true);
    try {
      const rc = await getReceipt(p.id, isTenant);
      setSelectedReceipt(rc);
    } catch {
      // Fallback: will still render receipt summary in modal and printable HTML view
    } finally {
      setReceiptLoading(false);
    }
  };

  // Print / Download Official Receipt HTML
  const handlePrintReceipt = async (paymentId: string) => {
    const printWin = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    if (!printWin) {
      setError('Popup diblokir oleh browser. Izinkan popup untuk mencetak kwitansi.');
      return;
    }
    try {
      const htmlContent = await getReceiptHTML(paymentId, isTenant);
      printWin.document.open();
      printWin.document.write(htmlContent);
      printWin.document.close();
      window.setTimeout(() => {
        try {
          printWin.focus();
          printWin.print();
        } catch {
          // User can still click Cetak Kwitansi (PDF) button inside the opened window
        }
      }, 350);
    } catch (err) {
      printWin.close();
      setError(err instanceof Error ? err.message : 'Gagal membuka halaman cetak kwitansi.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-teal/10 p-2 text-brand-teal">
              <CreditCard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-brand-navy lg:text-3xl">
                {isTenant ? 'Tagihan & Pembayaran Saya' : 'Manajemen Pembayaran & Rekonsiliasi'}
              </h1>
              <p className="text-sm text-slate-500">
                {isTenant
                  ? 'Kirim bukti pembayaran (penuh/parsial), pantau status verifikasi, dan unduh kwitansi resmi'
                  : `Verifikasi bukti transaksi, alokasi tagihan, dan rekonsiliasi kas ${activeProperty ? `(${activeProperty.name})` : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Action Button for Staff */}
        {!isTenant && canCreateBill && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreateBillModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#0c7668] transition"
            >
              <Plus className="h-4 w-4" />
              Buat Tagihan Manual
            </button>
          </div>
        )}
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-medium">{notice}</p>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Staff Tabs */}
      {!isTenant && (
        <div className="border-b border-slate-200">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'payments'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Receipt className="h-4 w-4" />
              Daftar Transaksi & Tagihan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reconciliation')}
              className={`pb-3 text-sm font-bold transition border-b-2 flex items-center gap-2 ${
                activeTab === 'reconciliation'
                  ? 'border-brand-teal text-brand-teal'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Scale className="h-4 w-4" />
              Laporan Rekonsiliasi Keuangan
            </button>
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS LIST */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="filter-payment-status" className="sr-only">Status</label>
                <select
                  id="filter-payment-status"
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-teal focus:outline-none"
                >
                  <option value="">Semua Status</option>
                  <option value="pending">Menunggu Verifikasi</option>
                  <option value="paid">Lunas</option>
                  <option value="partial">Dibayar Sebagian</option>
                  <option value="unpaid">Belum Bayar</option>
                  <option value="overdue">Terlambat</option>
                  <option value="rejected">Ditolak</option>
                </select>
              </div>

              {!isTenant && (
                <>
                  <div>
                    <label htmlFor="filter-month" className="sr-only">Bulan</label>
                    <select
                      id="filter-month"
                      value={filterMonth}
                      onChange={(e) => {
                        setFilterMonth(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-teal focus:outline-none"
                    >
                      <option value="">Semua Bulan</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          Bulan {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="filter-year" className="sr-only">Tahun</label>
                    <select
                      id="filter-year"
                      value={filterYear}
                      onChange={(e) => {
                        setFilterYear(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-brand-teal focus:outline-none"
                    >
                      <option value="">Semua Tahun</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </>
              )}

              {(filterStatus || filterMonth || filterYear) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStatus('');
                    setFilterMonth('');
                    setFilterYear('');
                    setCurrentPage(1);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-teal"
                >
                  Reset Filter
                </button>
              )}
            </div>

            <div className="text-xs font-semibold text-slate-400">
              Menampilkan {paginatedPayments.length} dari {payments.length} transaksi
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
            </div>
          ) : paginatedPayments.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <div className="rounded-full bg-slate-100 p-3 text-slate-400">
                <CreditCard className="h-8 w-8" />
              </div>
              <p className="mt-3 font-bold text-slate-700">Tidak ada transaksi pembayaran</p>
              <p className="mt-1 text-sm text-slate-400">
                {filterStatus || filterMonth || filterYear
                  ? 'Coba ubah atau reset filter pencarian Anda.'
                  : 'Belum ada pembayaran yang tercatat.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-3.5">Periode & Tempo</th>
                      {!isTenant && <th className="px-5 py-3.5">Penghuni & Kamar</th>}
                      <th className="px-5 py-3.5">Metode</th>
                      <th className="px-5 py-3.5 text-right">Total Tagihan</th>
                      <th className="px-5 py-3.5 text-right">Dibayar</th>
                      <th className="px-5 py-3.5 text-center">Status</th>
                      <th className="px-5 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPayments.map((p) => {
                      const totalBill = p.amount_minor > 0
                        ? p.amount_minor
                        : p.amount_rent + p.amount_electricity + p.amount_water + p.amount_other;
                      const paidAmount = p.paid_amount_minor > 0 ? p.paid_amount_minor : p.total_paid;
                      const roomNum = p.contract?.room?.room_number || '-';
                      const tenantName = p.contract?.user?.name || '-';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-5 py-4">
                            <div className="font-bold text-brand-navy">
                              {formatPeriod(p.period_month, p.period_year)}
                            </div>
                            <div className="text-xs text-slate-400">
                              Jatuh tempo: {formatDate(p.due_date)}
                            </div>
                          </td>

                          {!isTenant && (
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-800">{tenantName}</div>
                              <div className="text-xs text-slate-400">Kamar {roomNum}</div>
                            </td>
                          )}

                          <td className="px-5 py-4">
                            <span className="font-bold uppercase text-slate-600 text-xs">
                              {p.payment_method || p.provider || 'Transfer'}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-right font-semibold text-slate-800">
                            {formatMoney(totalBill, p.currency)}
                          </td>

                          <td className="px-5 py-4 text-right font-extrabold text-brand-navy">
                            <span className={paidAmount >= totalBill ? 'text-emerald-600' : 'text-slate-700'}>
                              {formatMoney(paidAmount, p.currency)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                                paymentStatusTone[p.status] || 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {paymentStatusLabel[p.status] || p.status}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Tenant Pay Action */}
                              {isTenant &&
                                (p.status === 'unpaid' ||
                                  p.status === 'partial' ||
                                  p.status === 'overdue' ||
                                  p.status === 'rejected' ||
                                  (p.status === 'pending' && p.provider === 'midtrans' && !p.proof_photo_url)) && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPay(p)}
                                    className="inline-flex items-center gap-1 rounded-lg bg-brand-teal px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#0c7668] transition"
                                  >
                                    <Upload className="h-3.5 w-3.5" />
                                    Bayar
                                  </button>
                                )}
                              {isTenant &&
                                p.status === 'pending' &&
                                (p.provider !== 'midtrans' || Boolean(p.proof_photo_url)) && (
                                  <button
                                    type="button"
                                    disabled
                                    title="Bukti pembayaran manual Anda sudah dikirim dan sedang menunggu verifikasi pemilik kos"
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 opacity-75 cursor-not-allowed"
                                  >
                                    <Clock className="h-3.5 w-3.5" />
                                    Menunggu Verifikasi
                                  </button>
                                )}

                              {/* Staff Verify Action */}
                              {!isTenant && canVerifyPayment && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenVerify(p)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:border-brand-teal hover:text-brand-teal transition"
                                >
                                  <ShieldCheck className="h-3.5 w-3.5 text-brand-teal" />
                                  Verifikasi
                                </button>
                              )}

                              {/* Receipt Action for Paid / Partial */}
                              {(p.status === 'paid' || p.status === 'partial') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceipt(p)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:border-brand-teal hover:text-brand-teal transition"
                                  title="Lihat Kwitansi Resmi"
                                >
                                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                                  Kwitansi
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                  <div>
                    Halaman {currentPage} dari {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                    >
                      Sebelumnya
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1 font-bold disabled:opacity-40"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB: FINANCIAL RECONCILIATION */}
      {activeTab === 'reconciliation' && !isTenant && (
        <div className="space-y-6">
          {/* Reconciliation Date Picker Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-brand-navy">Laporan Rekonsiliasi & Settlement</h2>
              <p className="text-xs text-slate-500">
                Pemeriksaan keseimbangan antara pembayaran masuk, alokasi tagihan, kredit overpayment, dan refund.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label htmlFor="reconcile-start" className="block text-slate-400 font-bold mb-1">Mulai</label>
                <input
                  id="reconcile-start"
                  type="date"
                  value={reconcileStartDate}
                  onChange={(e) => setReconcileStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5"
                />
              </div>
              <div>
                <label htmlFor="reconcile-end" className="block text-slate-400 font-bold mb-1">Sampai</label>
                <input
                  id="reconcile-end"
                  type="date"
                  value={reconcileEndDate}
                  onChange={(e) => setReconcileEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5"
                />
              </div>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={fetchReconciliation}
                  disabled={reconcileLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2 font-bold text-white shadow-xs hover:bg-[#0c7668] transition"
                >
                  {reconcileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Muat Ulang
                </button>
              </div>
            </div>
          </div>

          {/* Balance Status Banner */}
          {reconcileReport && (
            <div
              className={`rounded-2xl p-5 border flex items-center justify-between ${
                reconcileReport.is_balanced
                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                  : 'border-rose-200 bg-rose-50/70 text-rose-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {reconcileReport.is_balanced ? (
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-7 w-7 text-rose-600 shrink-0" />
                )}
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base">
                    {reconcileReport.is_balanced
                      ? 'Laporan Rekonsiliasi Seimbang (Reconciled)'
                      : 'Perbedaan Saldo Terdeteksi'}
                  </h3>
                  <p className="text-xs opacity-90">
                    {reconcileReport.is_balanced
                      ? 'Seluruh pembayaran terverifikasi memiliki alokasi tagihan, kredit overpayment, atau refund yang sesuai.'
                      : 'Terdapat selisih nominal yang memerlukan penyesuaian alokasi atau koreksi transaksi.'}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider border ${
                  reconcileReport.is_balanced
                    ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                    : 'border-rose-300 bg-rose-100 text-rose-800'
                }`}
              >
                {reconcileReport.is_balanced ? 'Balanced' : 'Discrepancy'}
              </span>
            </div>
          )}

          {/* Reconciliation Metric Cards */}
          {reconcileReport && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Diterima</p>
                <p className="mt-2 text-2xl font-extrabold text-brand-navy">
                  {formatMoney(reconcileReport.total_payments_received_minor)}
                </p>
                <p className="mt-1 text-xs text-slate-500">Pembayaran terverifikasi</p>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Teralokasi ke Tagihan</p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-700">
                  {formatMoney(reconcileReport.total_allocated_minor)}
                </p>
                <p className="mt-1 text-xs text-emerald-600/80">Invoice allocations</p>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-sky-600">Kredit Penyewa</p>
                <p className="mt-2 text-2xl font-extrabold text-sky-700">
                  {formatMoney(reconcileReport.total_credits_created_minor)}
                </p>
                <p className="mt-1 text-xs text-sky-600/80">Overpayment balance</p>
              </div>

              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-600">Net Settlement Kas</p>
                <p className="mt-2 text-2xl font-extrabold text-amber-700">
                  {formatMoney(reconcileReport.total_settlement_minor)}
                </p>
                <p className="mt-1 text-xs text-amber-600/80">Kas bersih properti</p>
              </div>
            </div>
          )}

          {/* Itemized Transactions Table */}
          {reconcileReport && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-bold text-brand-navy mb-3">Rincian Transaksi Masuk pada Periode</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">ID Transaksi</th>
                      <th className="px-4 py-2.5">Tanggal</th>
                      <th className="px-4 py-2.5">Metode / Provider</th>
                      <th className="px-4 py-2.5 text-right">Nominal</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reconcileReport.payments && reconcileReport.payments.length > 0 ? (
                      reconcileReport.payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-mono font-bold text-brand-navy">
                            {p.id.slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{formatDate(p.paid_at || p.created_at)}</td>
                          <td className="px-4 py-3 font-semibold text-slate-700 uppercase">
                            {p.payment_method || p.provider}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {formatMoney(p.paid_amount_minor)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold border ${
                                paymentStatusTone[p.status]
                              }`}
                            >
                              {paymentStatusLabel[p.status] || p.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          Tidak ada transaksi pembayaran pada rentang tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VERIFY MODAL (Staff) */}
      {showVerifyModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 p-6">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-6 w-6 text-brand-teal" />
                <div>
                  <h3 className="font-extrabold text-brand-navy text-lg">Verifikasi Bukti Pembayaran</h3>
                  <p className="text-xs text-slate-500">
                    Kamar {selectedPayment.contract?.room?.room_number || '-'} · Penghuni:{' '}
                    {selectedPayment.contract?.user?.name || '-'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
              {/* Proofs Gallery / Multi-Proof History */}
              <div>
                <h4 className="font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Histori Bukti Pembayaran Terunggah ({selectedPayment.proofs?.length || (selectedPayment.proof_photo_url ? 1 : 0)})
                </h4>
                {selectedPayment.proofs && selectedPayment.proofs.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedPayment.proofs.map((proof, idx) => (
                      <div key={proof.id} className="rounded-xl border border-slate-200 p-2.5 bg-slate-50 space-y-2">
                        <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                          <span>Bukti #{idx + 1} ({proof.payment_method})</span>
                          <span>{formatMoney(proof.amount_minor)}</span>
                        </div>
                        {proof.file_url && (
                          <a
                            href={getImageUrl(proof.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-lg border border-slate-200 hover:opacity-90"
                          >
                            <img
                              src={getImageUrl(proof.file_url)}
                              alt={`Bukti #${idx + 1}`}
                              className="h-36 w-full object-cover"
                            />
                          </a>
                        )}
                        <p className="text-[10px] text-slate-400">{formatDate(proof.created_at)} · {proof.notes || 'Tanpa catatan'}</p>
                      </div>
                    ))}
                  </div>
                ) : selectedPayment.proof_photo_url ? (
                  <div className="rounded-xl border border-slate-200 p-2.5 bg-slate-50 space-y-2">
                    <a
                      href={getImageUrl(selectedPayment.proof_photo_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-lg border border-slate-200 hover:opacity-90"
                    >
                      <img
                        src={getImageUrl(selectedPayment.proof_photo_url)}
                        alt="Bukti Transfer"
                        className="h-44 w-full object-cover"
                      />
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Penyewa belum mengunggah foto bukti transfer.</p>
                )}
              </div>

              {/* Verification Form Controls */}
              <div className="space-y-3 pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="verify-status" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Keputusan Verifikasi
                    </label>
                    <select
                      id="verify-status"
                      value={verifyForm.status}
                      onChange={(e) =>
                        setVerifyForm({ ...verifyForm, status: e.target.value as PaymentStatus })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 font-semibold"
                    >
                      <option value="paid">Lunas (Terverifikasi Penuh)</option>
                      <option value="partial">Dibayar Sebagian (Parsial)</option>
                      <option value="rejected">Tolak Pembayaran</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="verify-amount" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Nominal Masuk Rekening (IDR)
                    </label>
                    <input
                      id="verify-amount"
                      type="number"
                      min={0}
                      value={verifyForm.paid_amount_minor || 0}
                      onChange={(e) =>
                        setVerifyForm({ ...verifyForm, paid_amount_minor: parseInt(e.target.value) || 0 })
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800 font-bold"
                    />
                  </div>
                </div>

                {verifyForm.status === 'rejected' ? (
                  <div>
                    <label htmlFor="verify-rejection" className="block font-bold text-rose-600 uppercase tracking-wider">
                      Alasan Penolakan (Wajib Diisi)
                    </label>
                    <textarea
                      id="verify-rejection"
                      rows={2}
                      placeholder="Contoh: Bukti transfer buram / dana belum masuk rekening bank"
                      value={verifyForm.rejection_reason || ''}
                      onChange={(e) => setVerifyForm({ ...verifyForm, rejection_reason: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-rose-200 bg-rose-50/30 p-2.5 text-slate-800"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="verify-notes" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Catatan Verifikasi / Referensi Mutasi Bank
                    </label>
                    <input
                      id="verify-notes"
                      type="text"
                      placeholder="Contoh: Mutasi BCA tgl 14/10 a.n Budi"
                      value={verifyForm.notes || ''}
                      onChange={(e) => setVerifyForm({ ...verifyForm, notes: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>
                )}

                {verifyForm.status !== 'rejected' && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={verifyForm.credit_overpayment ?? true}
                      onChange={(e) => setVerifyForm({ ...verifyForm, credit_overpayment: e.target.checked })}
                      className="h-4 w-4 rounded accent-brand-teal"
                    />
                    <span className="text-slate-700 font-medium">
                      Simpan kelebihan pembayaran (jika ada) sebagai saldo kredit penyewa
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4">
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleSubmitVerify}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 font-bold text-white shadow-sm transition ${
                  verifyForm.status === 'rejected'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-brand-teal hover:bg-[#0c7668]'
                } disabled:opacity-50`}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {verifyForm.status === 'rejected' ? 'Tolak Pembayaran' : 'Simpan Verifikasi & Terbitkan Kwitansi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TENANT PAY MODAL */}
      {showPayModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 p-6">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 text-brand-teal" />
                <div>
                  <h3 className="font-extrabold text-brand-navy text-lg">Pembayaran Tagihan Kos</h3>
                  <p className="text-xs text-slate-500">
                    Pilih pembayaran instan otomatis (Midtrans Sandbox) atau unggah bukti transfer manual
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Bill Summary Card */}
              <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-teal-900">Periode Tagihan</span>
                  <span className="font-extrabold text-brand-navy text-sm">
                    {formatPeriod(selectedPayment.period_month, selectedPayment.period_year)}
                  </span>
                </div>

                <div className="border-t border-teal-200/60 pt-2 space-y-1 text-slate-600">
                  {selectedPayment.amount_rent > 0 && (
                    <div className="flex justify-between">
                      <span>Sewa Kamar Bulanan</span>
                      <span className="font-semibold text-slate-800">{formatMoney(selectedPayment.amount_rent)}</span>
                    </div>
                  )}
                  {selectedPayment.amount_electricity > 0 && (
                    <div className="flex justify-between">
                      <span>Biaya Listrik</span>
                      <span className="font-semibold text-slate-800">{formatMoney(selectedPayment.amount_electricity)}</span>
                    </div>
                  )}
                  {selectedPayment.amount_water > 0 && (
                    <div className="flex justify-between">
                      <span>Biaya Air</span>
                      <span className="font-semibold text-slate-800">{formatMoney(selectedPayment.amount_water)}</span>
                    </div>
                  )}
                  {selectedPayment.amount_other > 0 && (
                    <div className="flex justify-between">
                      <span>Biaya Lainnya / Denda</span>
                      <span className="font-semibold text-slate-800">{formatMoney(selectedPayment.amount_other)}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center border-t border-teal-200/80 pt-2 text-sm">
                  <span className="font-bold text-teal-950">Total Tagihan</span>
                  <span className="font-extrabold text-brand-teal text-base">
                    {formatMoney(
                      selectedPayment.amount_minor ||
                        selectedPayment.amount_rent +
                          selectedPayment.amount_electricity +
                          selectedPayment.amount_water +
                          selectedPayment.amount_other,
                    )}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    selectedPayment.status === 'paid' ||
                    selectedPayment.status === 'partial' ||
                    (selectedPayment.status === 'pending' &&
                      (selectedPayment.provider !== 'midtrans' || Boolean(selectedPayment.proof_photo_url)))
                  }
                  onClick={() => setTenantPaymentMode('midtrans')}
                  className={`rounded-2xl border p-3.5 text-left transition ${
                    tenantPaymentMode === 'midtrans'
                      ? 'border-brand-teal bg-teal-50/40 ring-2 ring-brand-teal/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-brand-navy text-xs">
                      Bayar Instan Online (Midtrans Sandbox)
                    </span>
                    <span className="rounded-full bg-brand-teal/15 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                      Otomatis
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Verifikasi instan & kwitansi digital terbit otomatis tanpa menunggu pemilik kos.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTenantPaymentMode('manual')}
                  className={`rounded-2xl border p-3.5 text-left transition ${
                    tenantPaymentMode === 'manual'
                      ? 'border-brand-teal bg-teal-50/40 ring-2 ring-brand-teal/20'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-brand-navy text-xs">
                      Transfer Manual & Upload Bukti
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Cadangan
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Unggah foto resi transfer bank atau cicilan parsial untuk diverifikasi staf.
                  </p>
                </button>
              </div>

              {/* Mode 1: Midtrans Snap Instant Online Payment */}
              {tenantPaymentMode === 'midtrans' ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                  <div>
                    <p className="font-bold text-slate-600 uppercase tracking-wider text-[11px] mb-2">
                      Channel Pembayaran Populer yang Didukung
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['QRIS', 'GoPay', 'Virtual Account BCA', 'Mandiri Bill', 'BNI VA', 'BRI VA'].map(
                        (channel) => (
                          <span
                            key={channel}
                            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs"
                          >
                            {channel}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-[11px] text-sky-900 space-y-1">
                    <p className="font-bold">Mode Portofolio (Midtrans Sandbox Simulator):</p>
                    <p>
                      Tidak menggunakan uang asli. Setelah menyalin nomor Virtual Account atau kode QRIS dari popup Snap, simulasikan pelunasan di{' '}
                      <a
                        href="https://simulator.sandbox.midtrans.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold underline text-brand-teal hover:text-[#0c7668]"
                      >
                        Midtrans Payment Simulator
                      </a>
                      .
                    </p>
                  </div>

                  {(hasSavedSnapSession || selectedPayment.status === 'pending') && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[11px] text-amber-900 space-y-1">
                      <p className="font-bold">Sesi Pembayaran Sebelumnya Masih Aktif:</p>
                      <p>
                        Klik <span className="font-bold">Lanjutkan Pembayaran</span> untuk langsung menuju ke halaman instruksi pembayaran terakhir Anda, atau klik{' '}
                        <span className="font-bold">Ganti Metode Pembayaran</span> untuk membatalkan metode sebelumnya dan memilih metode lain (misalnya dari VA ke QRIS / GoPay).
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPayModal(false)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    {(hasSavedSnapSession || selectedPayment.status === 'pending') && (
                      <button
                        type="button"
                        disabled={snapLoading}
                        onClick={() => void handlePayWithMidtrans(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-teal/40 bg-white px-4 py-2 font-bold text-brand-teal hover:bg-teal-50 disabled:opacity-50 transition"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${snapLoading ? 'animate-spin' : ''}`} />
                        Ganti Metode Pembayaran
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={snapLoading}
                      onClick={() => void handlePayWithMidtrans(false)}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 font-bold text-white shadow-sm hover:bg-[#0c7668] disabled:opacity-50 transition"
                    >
                      {snapLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4" />
                      )}
                      {hasSavedSnapSession || selectedPayment.status === 'pending'
                        ? 'Lanjutkan Pembayaran'
                        : 'Bayar Sekarang via Midtrans'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Mode 2: Manual Bank Transfer & Proof Upload */
                <form onSubmit={handleSubmitPay} className="space-y-4">
                  <div>
                    <label htmlFor="pay-amount" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Nominal yang Ditransfer (IDR)
                    </label>
                    <input
                      id="pay-amount"
                      type="number"
                      min={1000}
                      required
                      value={tenantPayForm.total_paid || 0}
                      onChange={(e) => setTenantPayForm({ ...tenantPayForm, total_paid: parseFloat(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-bold text-slate-800"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Mendukung pembayaran penuh maupun cicilan (parsial). Bukti sebelumnya tetap tersimpan rapi.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="pay-method" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Metode Pembayaran
                    </label>
                    <select
                      id="pay-method"
                      value={tenantPayForm.payment_method}
                      onChange={(e) => setTenantPayForm({ ...tenantPayForm, payment_method: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-slate-800"
                    >
                      <option value="transfer">Transfer Bank (BCA / Mandiri / BRI / BNI)</option>
                      <option value="qris">QRIS / E-Wallet (GoPay, OVO, Dana)</option>
                      <option value="cash">Tunai (Cash ke Pengelola)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="pay-file" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Unggah Foto Bukti Transfer / Resi
                    </label>
                    <input
                      id="pay-file"
                      type="file"
                      accept="image/*,.pdf"
                      required
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setTenantPayForm({ ...tenantPayForm, file: e.target.files[0] });
                        }
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-700"
                    />
                  </div>

                  <div>
                    <label htmlFor="pay-notes" className="block font-bold text-slate-500 uppercase tracking-wider">
                      Catatan Tambahan (Opsional)
                    </label>
                    <input
                      id="pay-notes"
                      type="text"
                      placeholder="Contoh: Transfer atas nama Budi"
                      value={tenantPayForm.notes}
                      onChange={(e) => setTenantPayForm({ ...tenantPayForm, notes: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPayModal(false)}
                      className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2 font-bold text-white shadow-sm hover:bg-[#0c7668] disabled:opacity-50"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Kirim Bukti Pembayaran
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE BILL MODAL (Staff) */}
      {showCreateBillModal && !isTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-lg rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 p-6">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-teal" />
                <h3 className="font-extrabold text-brand-navy text-lg">Buat Tagihan Manual</h3>
              </div>
              <button type="button" onClick={() => setShowCreateBillModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBill} className="p-6 space-y-3 text-xs">
              <div>
                <label htmlFor="bill-contract" className="block font-bold text-slate-500 uppercase tracking-wider">
                  Pilih Kontrak / Kamar
                </label>
                <select
                  id="bill-contract"
                  required
                  value={newBill.contract_id}
                  onChange={(e) => {
                    const cid = e.target.value;
                    const c = contracts.find((item) => item.id === cid);
                    setNewBill({
                      ...newBill,
                      contract_id: cid,
                      amount_rent: c?.monthly_rent || 0,
                    });
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-800"
                >
                  <option value="">-- Pilih Kontrak --</option>
                  {contracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Kamar {c.room?.room_number || '-'} - {c.user?.name || 'Penyewa'} ({formatMoney(c.monthly_rent)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="bill-month" className="block font-bold text-slate-500 uppercase tracking-wider">Bulan</label>
                  <input
                    id="bill-month"
                    type="number"
                    min={1}
                    max={12}
                    value={newBill.period_month}
                    onChange={(e) => setNewBill({ ...newBill, period_month: parseInt(e.target.value) || 1 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="bill-year" className="block font-bold text-slate-500 uppercase tracking-wider">Tahun</label>
                  <input
                    id="bill-year"
                    type="number"
                    min={2020}
                    value={newBill.period_year}
                    onChange={(e) => setNewBill({ ...newBill, period_year: parseInt(e.target.value) || 2026 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="bill-rent" className="block font-bold text-slate-500 uppercase tracking-wider">Sewa Kamar (IDR)</label>
                  <input
                    id="bill-rent"
                    type="number"
                    min={0}
                    value={newBill.amount_rent}
                    onChange={(e) => setNewBill({ ...newBill, amount_rent: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="bill-elec" className="block font-bold text-slate-500 uppercase tracking-wider">Listrik (IDR)</label>
                  <input
                    id="bill-elec"
                    type="number"
                    min={0}
                    value={newBill.amount_electricity}
                    onChange={(e) => setNewBill({ ...newBill, amount_electricity: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="bill-water" className="block font-bold text-slate-500 uppercase tracking-wider">Air (IDR)</label>
                  <input
                    id="bill-water"
                    type="number"
                    min={0}
                    value={newBill.amount_water}
                    onChange={(e) => setNewBill({ ...newBill, amount_water: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
                <div>
                  <label htmlFor="bill-other" className="block font-bold text-slate-500 uppercase tracking-wider">Lainnya (IDR)</label>
                  <input
                    id="bill-other"
                    type="number"
                    min={0}
                    value={newBill.amount_other}
                    onChange={(e) => setNewBill({ ...newBill, amount_other: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bill-due" className="block font-bold text-slate-500 uppercase tracking-wider">Tanggal Jatuh Tempo</label>
                <input
                  id="bill-due"
                  type="date"
                  required
                  value={newBill.due_date}
                  onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateBillModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2 font-bold text-white shadow-sm hover:bg-[#0c7668] disabled:opacity-50"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Tagihan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {showReceiptModal && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="relative my-8 w-full max-w-xl rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/75 p-6">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="h-6 w-6 text-emerald-600" />
                <div>
                  <h3 className="font-extrabold text-brand-navy text-lg">Kwitansi Digital Resmi</h3>
                  <p className="text-xs text-slate-500">
                    No. Kwitansi: {selectedReceipt?.receipt_number || `#REC-${selectedPayment.id.slice(0, 8)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {receiptLoading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Penghuni</span>
                        <p className="font-bold text-slate-800 text-sm">
                          {selectedPayment.contract?.user?.name || '-'}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Kamar</span>
                        <p className="font-bold text-slate-800 text-sm">
                          Kamar {selectedPayment.contract?.room?.room_number || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-200">
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Periode</span>
                        <p className="font-medium text-slate-700">
                          {formatPeriod(selectedPayment.period_month, selectedPayment.period_year)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase tracking-wider">Tanggal Bayar</span>
                        <p className="font-medium text-slate-700">
                          {formatDate(selectedPayment.paid_at || selectedPayment.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Terverifikasi</span>
                      <p className="text-2xl font-extrabold text-emerald-700">
                        {formatMoney(selectedPayment.paid_amount_minor || selectedPayment.total_paid)}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-200/80 px-3 py-1 font-extrabold text-emerald-900 uppercase tracking-wider text-[11px]">
                      Lunas Terverifikasi
                    </span>
                  </div>

                  {/* Cryptographic SHA-256 Checksum Badge */}
                  {selectedReceipt?.checksum && (
                    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <ShieldCheck className="h-4 w-4 text-brand-teal" />
                        <span>Integritas Kriptografis (SHA-256 Checksum)</span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-600 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
                        {selectedReceipt.checksum}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Kwitansi ini dijamin immutable dan telah diverifikasi secara elektronik oleh sistem Lapor Kos.
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void handlePrintReceipt(selectedPayment.id)}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 font-bold text-white shadow-sm hover:bg-[#0c7668] transition"
                    >
                      <Printer className="h-4 w-4" />
                      Cetak / Unduh Kwitansi PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
