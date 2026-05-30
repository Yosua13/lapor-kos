'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Calendar, FileText, Check, AlertTriangle, 
  Banknote, DoorOpen, User, RefreshCw, X, Loader2, Edit2, Trash2
} from 'lucide-react';
import Link from 'next/link';

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [extendDuration, setExtendDuration] = useState('1');
  const [isExtending, setIsExtending] = useState(false);

  const getMonths = (start: string, end: string) => {
    const d1 = new Date(start);
    const d2 = new Date(end);
    let months = (d2.getFullYear() - d1.getFullYear()) * 12;
    months -= d1.getMonth();
    months += d2.getMonth();
    return months <= 0 ? 1 : months;
  };

  useEffect(() => {
    setMounted(true);
    fetchContract();
  }, [params.id]);

  const fetchContract = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch(`/api/contracts/${params.id}`);
      setContract(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendDuration) return;
    
    setIsExtending(true);
    try {
      const currentEnd = new Date(contract.end_date);
      const newEnd = new Date(currentEnd);
      newEnd.setMonth(currentEnd.getMonth() + parseInt(extendDuration));
      const finalExtendDate = newEnd.toISOString().split('T')[0];

      await apiFetch(`/api/contracts/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ end_date: finalExtendDate })
      });
      setIsExtendModalOpen(false);
      fetchContract();
    } catch (err: any) {
      alert(err.message || 'Gagal memperpanjang kontrak');
    } finally {
      setIsExtending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus kontrak ini? Status kamar akan dikembalikan menjadi tersedia.')) return;
    
    try {
      await apiFetch(`/api/contracts/${params.id}`, { method: 'DELETE' });
      router.push('/contracts');
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kontrak');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (!mounted) return null;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-brand-teal border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!contract) {
    return <div className="text-center py-20 text-gray-500">Kontrak tidak ditemukan</div>;
  }

  return (
    <div className="space-y-6 animate-slide-up pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/contracts" className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-brand-teal hover:border-brand-teal transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-display font-bold text-brand-navy">Detail Kontrak</h1>
            <p className="text-sm text-gray-500 mt-1">ID: {contract.id.split('-')[0].toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleDelete} className="px-4 py-2 border-[1.5px] border-red-200 text-red-500 font-bold text-sm rounded-xl hover:bg-red-50 transition-colors flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Hapus
          </button>
          <button
            onClick={() => setIsExtendModalOpen(true)}
            className="px-4 py-2 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center gap-2 shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Perpanjang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
            <div className={`h-1.5 w-full ${contract.status === 'active' ? 'bg-brand-teal' : 'bg-red-500'}`}></div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-brand-navy"><FileText className="w-6 h-6" /></div>
                  <div>
                    <h2 className="text-xl font-bold text-brand-navy">Perjanjian Sewa</h2>
                    <p className="text-sm text-gray-500">Dibuat pada {formatDate(contract.created_at)}</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  contract.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {contract.status === 'active' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {contract.status === 'active' ? 'Kontrak Aktif' : 'Kontrak Berakhir'}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pihak Pertama (Kamar)</p>
                  <p className="text-lg font-bold text-brand-navy">Kamar {contract.room?.room_number}</p>
                  <p className="text-sm text-gray-500 mt-1">Tarif Normal: {formatCurrency(contract.room?.price_per_month)}/bln</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pihak Kedua (Penyewa)</p>
                  <p className="text-lg font-bold text-brand-navy">{contract.tenant?.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{contract.tenant?.phone}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <h3 className="text-sm font-bold text-brand-navy mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-brand-teal" /> Periode & Pembayaran</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tanggal Mulai</p>
                    <p className="font-bold text-brand-navy">{formatDate(contract.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tanggal Selesai</p>
                    <p className="font-bold text-brand-navy">{formatDate(contract.end_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sewa Bulanan Disepakati</p>
                    <p className="font-bold text-brand-teal">{formatCurrency(contract.monthly_rent)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Uang Deposit</p>
                    <p className="font-bold text-brand-navy">{formatCurrency(contract.deposit)}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-600">Jatuh tempo pembayaran setiap <span className="font-bold text-brand-navy">Tanggal {contract.payment_due_day}</span> per bulannya.</p>
                </div>
              </div>

              <div className="mt-6 bg-brand-teal/5 border border-brand-teal/20 rounded-xl p-6 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Harga yang Harus Dibayar</p>
                  <p className="text-3xl font-display font-bold text-brand-teal">
                    {formatCurrency(contract.monthly_rent * getMonths(contract.start_date, contract.end_date))}
                  </p>
                </div>
              </div>

              {contract.notes && (
                <div className="mt-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Catatan Tambahan</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">{contract.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isExtendModalOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-500"
          style={{
            position: 'fixed',
            inset: 0,
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            backgroundColor: 'rgba(11, 31, 53, 0.45)',
          }}
        >
          <div className="relative bg-white rounded-[32px] pt-8 px-8 pb-8 w-full max-w-md shadow-[0_20px_60px_rgba(15,23,42,0.2)] animate-slide-up flex flex-col overflow-hidden">
            <div className="mb-6 shrink-0 text-center">
              <span className="inline-block px-2.5 py-1 bg-brand-teal/10 text-brand-teal text-[10px] font-extrabold uppercase tracking-widest rounded-md mb-2">
                PERPANJANGAN
              </span>
              <h3 className="text-2xl font-display font-bold text-brand-navy leading-tight">
                Perpanjang Kontrak
              </h3>
            </div>
            <button onClick={() => setIsExtendModalOpen(false)} className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-brand-navy hover:bg-gray-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
            
            <form onSubmit={handleExtend}>
              <div className="mb-6 space-y-4">
                <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-xl border border-blue-100 text-center">
                  Berakhir pada: <b>{formatDate(contract.end_date)}</b>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy">Durasi Perpanjangan <span className="text-red-500">*</span></label>
                  <select 
                    required
                    value={extendDuration}
                    onChange={(e) => setExtendDuration(e.target.value)}
                    className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
                  >
                    <option value="1">1 Bulan</option>
                    <option value="3">3 Bulan</option>
                    <option value="6">6 Bulan</option>
                    <option value="12">12 Bulan (1 Tahun)</option>
                  </select>
                  <p className="text-[10px] text-brand-teal font-medium mt-1">
                    Tanggal berakhir baru: {
                      (() => {
                        const newEnd = new Date(contract.end_date);
                        newEnd.setMonth(newEnd.getMonth() + parseInt(extendDuration));
                        return newEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                      })()
                    }
                  </p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsExtendModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isExtending} className="flex-1 py-3 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {isExtending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
