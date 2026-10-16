'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Filter,
  Loader2,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
  CreditCard,
  Building,
} from 'lucide-react';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import {
  listExpenses,
  createExpense,
  updateExpense,
  approveExpense,
  payExpense,
  deleteExpense,
  getPeriodClosure,
} from '@/features/finance/api';
import type { Expense, ExpenseCategory, ExpenseFilter, ExpenseStatus } from '@/features/finance/types';
import {
  formatCurrency,
  formatExpenseCategory,
  formatExpenseStatus,
} from '@/features/finance/format';

const CATEGORIES: Array<{ key: ExpenseCategory; label: string }> = [
  { key: 'maintenance', label: 'Perawatan & Servis' },
  { key: 'utilities', label: 'Listrik, Air & WiFi' },
  { key: 'cleaning', label: 'Kebersihan & Sampah' },
  { key: 'supplies', label: 'Perlengkapan Kos' },
  { key: 'operational', label: 'Operasional Umum' },
  { key: 'tax_legal', label: 'Pajak & Legalitas' },
  { key: 'marketing', label: 'Pemasaran & Iklan' },
  { key: 'staff_salary', label: 'Gaji & Upah Staff' },
  { key: 'other', label: 'Lain-lain' },
];

export default function ExpensesPage() {
  const { activeProperty } = useActiveProperty();
  const { can } = useAuthorization();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'maintenance' as ExpenseCategory,
    vendor_name: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer',
    description: '',
    status: 'approved' as 'draft' | 'pending_approval' | 'approved' | 'paid',
  });

  const propertyId = activeProperty?.id;

  const loadExpenses = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const filter: ExpenseFilter = {
        page,
        page_size: pageSize,
        search: search.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      const res = await listExpenses(propertyId, filter);
      setExpenses(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar pengeluaran');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, page, pageSize, search, selectedCategory, selectedStatus, startDate, endDate]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  // Actions
  const handleApprove = async (id: string) => {
    if (!propertyId) return;
    try {
      await approveExpense(propertyId, id);
      setSuccessMessage('Pengeluaran berhasil disetujui');
      loadExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyetujui pengeluaran');
    }
  };

  const handlePay = async (id: string) => {
    if (!propertyId) return;
    try {
      await payExpense(propertyId, id);
      setSuccessMessage('Pengeluaran berhasil ditandai telah dibayar');
      loadExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal memproses pembayaran');
    }
  };

  const handleDelete = async (id: string) => {
    if (!propertyId) return;
    if (!confirm('Apakah Anda yakin ingin menghapus catatan pengeluaran ini?')) return;
    try {
      await deleteExpense(propertyId, id);
      setSuccessMessage('Pengeluaran berhasil dihapus');
      loadExpenses();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus pengeluaran');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
    setFormError(null);

    const amountMinor = Math.round(Number(formData.amount));
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setFormError('Nominal pengeluaran harus berupa angka positif');
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if period is closed first to give immediate clear feedback
      const periodKey = formData.expense_date.slice(0, 7);
      try {
        const closure = await getPeriodClosure(propertyId, periodKey);
        if (closure && closure.status !== 'reopened') {
          setFormError(
            `Periode ${periodKey} telah ditutup buku (closed). Penambahan pengeluaran baru pada periode ini wajib melalui menu Adjustment.`,
          );
          setIsSubmitting(false);
          return;
        }
      } catch {
        // Not closed, proceed
      }

      await createExpense(propertyId, {
        title: formData.title.trim(),
        category: formData.category,
        vendor_name: formData.vendor_name.trim(),
        amount_minor: amountMinor,
        expense_date: formData.expense_date,
        payment_method: formData.payment_method,
        description: formData.description.trim(),
        status: formData.status,
      });

      setIsCreateModalOpen(false);
      setSuccessMessage('Pengeluaran berhasil dicatat');
      setFormData({
        title: '',
        category: 'maintenance',
        vendor_name: '',
        amount: '',
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: 'bank_transfer',
        description: '',
        status: 'approved',
      });
      loadExpenses();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan pengeluaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const totalAmount = expenses.reduce((sum, item) => sum + item.amount_minor, 0);
    const paidCount = expenses.filter((e) => e.status === 'paid').length;
    const pendingCount = expenses.filter((e) => e.status === 'pending_approval' || e.status === 'draft').length;
    return { totalAmount, paidCount, pendingCount };
  }, [expenses]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-navy">
            Biaya & Pengeluaran Operasional
          </h1>
          <p className="text-sm text-brand-navy/60">
            Pencatatan beban operasional, bukti kwitansi, vendor, dan rekonsiliasi kas {activeProperty?.name}
          </p>
        </div>

        {can(CAPABILITIES.EXPENSE_WRITE) && (
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal/90"
          >
            <Plus className="h-4 w-4" />
            Catat Pengeluaran
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-700 hover:text-rose-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Halaman Ini</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-800">{formatCurrency(metrics.totalAmount)}</p>
          <p className="mt-1 text-xs text-slate-400">Dari {expenses.length} pengeluaran terdaftar</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Telah Dibayar (Lunas)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-700">{metrics.paidCount}</p>
          <p className="mt-1 text-xs text-slate-400">Arus kas keluar terkonfirmasi</p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Menunggu Approval / Draf</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold text-sky-700">{metrics.pendingCount}</p>
          <p className="mt-1 text-xs text-slate-400">Perlu peninjauan & otorisasi</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari judul, vendor, nomor kwitansi..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-brand-teal focus:outline-none"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-brand-teal focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 px-3 text-sm focus:border-brand-teal focus:outline-none"
            >
              <option value="all">Semua Status</option>
              <option value="approved">Disetujui</option>
              <option value="paid">Dibayar</option>
              <option value="pending_approval">Menunggu Persetujuan</option>
              <option value="draft">Draf</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 px-2 text-xs focus:border-brand-teal focus:outline-none"
            />
            <span className="text-slate-400">-</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-slate-200 py-2 px-2 text-xs focus:border-brand-teal focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-teal" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center p-6">
            <Receipt className="h-12 w-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-700">Belum ada pengeluaran</p>
            <p className="text-sm text-slate-400 mt-1 max-w-sm">
              Catatan biaya operasional yang Anda tambahkan akan muncul di sini secara kronologis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Tanggal & No</th>
                  <th className="py-3.5 px-4">Judul & Keterangan</th>
                  <th className="py-3.5 px-4">Kategori</th>
                  <th className="py-3.5 px-4">Vendor / Pihak</th>
                  <th className="py-3.5 px-4 text-right">Nominal</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {expenses.map((item) => {
                  const cat = formatExpenseCategory(item.category);
                  const st = formatExpenseStatus(item.status);

                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/60">
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">{item.expense_date}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{item.expense_number}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{item.title}</div>
                        {item.description && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{item.description}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${cat.badgeBg} ${cat.badgeText}`}>
                          {cat.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{item.vendor_name || 'Internal'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(item.amount_minor)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.text} ${st.border}`}>
                          {st.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {can(CAPABILITIES.EXPENSE_APPROVE) && (item.status === 'draft' || item.status === 'pending_approval') && (
                            <button
                              type="button"
                              onClick={() => handleApprove(item.id)}
                              className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              Setujui
                            </button>
                          )}

                          {can(CAPABILITIES.EXPENSE_WRITE) && item.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handlePay(item.id)}
                              className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                            >
                              Bayar
                            </button>
                          )}

                          {can(CAPABILITIES.EXPENSE_WRITE) && (item.status === 'draft' || item.status === 'pending_approval' || item.status === 'rejected') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="rounded-lg p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                              title="Hapus Pengeluaran"
                            >
                              <Trash2 className="h-4 w-4" />
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
        )}

        {/* Pagination Controls */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <div>
              Menampilkan <span className="font-medium">{(page - 1) * pageSize + 1}</span> -{' '}
              <span className="font-medium">{Math.min(page * pageSize, total)}</span> dari{' '}
              <span className="font-medium">{total}</span> data
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium">
                Halaman {page} dari {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Expense Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Catat Pengeluaran Baru</h2>
                <p className="text-xs text-slate-500">Isi rincian pengeluaran operasional kos</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Judul Pengeluaran *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Beli Pompa Air Cadangan"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Kategori *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Nominal (IDR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Contoh: 350000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Tanggal Pengeluaran *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.expense_date}
                    onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Nama Vendor / Toko
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Toko Bangunan Jaya"
                    value={formData.vendor_name}
                    onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  >
                    <option value="bank_transfer">Transfer Bank</option>
                    <option value="cash">Tunai (Kasbon/Cash)</option>
                    <option value="e_wallet">E-Wallet (GoPay/OVO/Dana)</option>
                    <option value="credit_card">Kartu Kredit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                    Status Awal
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                  >
                    <option value="approved">Langsung Disetujui</option>
                    <option value="paid">Langsung Lunas (Sudah Dibayar)</option>
                    <option value="pending_approval">Menunggu Persetujuan</option>
                    <option value="draft">Simpan sebagai Draf</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
                  Keterangan Tambahan / Catatan
                </label>
                <textarea
                  rows={2}
                  placeholder="Rincian pembelian atau keperluan..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-teal/90 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
