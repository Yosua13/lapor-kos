'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Calendar, FileText, Check, AlertTriangle, 
  Trash2, Loader2, Edit2, Save
} from 'lucide-react';
import Link from 'next/link';

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [contract, setContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    start_date: '',
    rental_duration: 1,
    end_date: '',
    monthly_rent: '',
    deposit: '',
    payment_due_day: '',
    status: '',
    notes: ''
  });

  useEffect(() => {
    if (isEditing && formData.start_date && formData.rental_duration) {
      const d = new Date(formData.start_date);
      d.setMonth(d.getMonth() + Number(formData.rental_duration));
      setFormData(prev => ({ ...prev, end_date: d.toISOString().split('T')[0] }));
    }
  }, [formData.start_date, formData.rental_duration, isEditing]);

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
      setFormData({
        start_date: data.start_date ? data.start_date.split('T')[0] : '',
        rental_duration: data.rental_duration || 1,
        end_date: data.end_date ? data.end_date.split('T')[0] : '',
        monthly_rent: data.monthly_rent?.toString() || '0',
        deposit: data.deposit?.toString() || '0',
        payment_due_day: data.payment_due_day?.toString() || '1',
        status: data.status || 'active',
        notes: data.notes || ''
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/api/contracts/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          start_date: formData.start_date,
          rental_duration: Number(formData.rental_duration),
          end_date: formData.end_date,
          monthly_rent: parseFloat(formData.monthly_rent),
          deposit: parseFloat(formData.deposit),
          payment_due_day: parseInt(formData.payment_due_day),
          status: formData.status,
          notes: formData.notes
        })
      });
      setIsEditing(false);
      fetchContract();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan kontrak');
    } finally {
      setIsSaving(false);
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
          {isEditing ? (
            <>
              <button onClick={() => { setIsEditing(false); fetchContract(); }} className="px-6 py-2 border-[1.5px] border-gray-200 text-brand-navy font-bold text-sm rounded-xl hover:bg-gray-50 transition-colors">
                Batal
              </button>
              <button onClick={handleUpdate} disabled={isSaving} className="px-6 py-2 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} className="px-4 py-2 border-[1.5px] border-red-200 text-red-500 font-bold text-sm rounded-xl hover:bg-red-50 transition-colors flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Hapus
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-brand-teal/10 text-brand-teal font-bold text-sm rounded-xl hover:bg-brand-teal/20 transition-all flex items-center gap-2 shadow-sm"
              >
                <Edit2 className="w-4 h-4" /> Edit Kontrak
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
            <div className={`h-1.5 w-full ${(isEditing ? formData.status : contract.status) === 'active' ? 'bg-brand-teal' : 'bg-red-500'}`}></div>
            <div className="p-8">
              
              {isEditing && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-6 py-3 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-sm mb-6">
                  <Edit2 className="w-4 h-4" /> Mode Edit Aktif — Jangan lupa simpan perubahan Anda.
                </div>
              )}

              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-brand-navy"><FileText className="w-6 h-6" /></div>
                  <div>
                    <h2 className="text-xl font-bold text-brand-navy">Perjanjian Sewa</h2>
                    <p className="text-sm text-gray-500">Dibuat pada {formatDate(contract.created_at)}</p>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  (isEditing ? formData.status : contract.status) === 'active' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                  {(isEditing ? formData.status : contract.status) === 'active' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {isEditing ? (
                    <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="bg-transparent font-bold outline-none cursor-pointer text-current">
                      <option value="active">Kontrak Aktif</option>
                      <option value="expired">Kontrak Berakhir</option>
                    </select>
                  ) : (
                    contract.status === 'active' ? 'Kontrak Aktif' : 'Kontrak Berakhir'
                  )}
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
                    {isEditing ? (
                      <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full text-sm font-bold text-brand-navy border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all" />
                    ) : (
                      <p className="font-bold text-brand-navy">{formatDate(contract.start_date)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Durasi Sewa & Selesai</p>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <select value={formData.rental_duration} onChange={e => setFormData({...formData, rental_duration: Number(e.target.value)})} className="w-24 text-sm font-bold text-brand-navy border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all cursor-pointer">
                          <option value="1">1 Bln</option>
                          <option value="3">3 Bln</option>
                          <option value="6">6 Bln</option>
                          <option value="12">12 Bln</option>
                        </select>
                        <input type="text" readOnly value={formatDate(formData.end_date)} className="flex-1 text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-not-allowed" />
                      </div>
                    ) : (
                      <p className="font-bold text-brand-navy">{formatDate(contract.end_date)} <span className="text-gray-400 text-xs font-normal">({contract.rental_duration} bln)</span></p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Sewa Bulanan Disepakati</p>
                    <p className="font-bold text-brand-teal">{formatCurrency(contract.monthly_rent)} <span className="text-[10px] text-gray-400 font-normal uppercase ml-1">(Terkunci)</span></p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Uang Deposit</p>
                    {isEditing ? (
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
                        <input type="text" value={formData.deposit ? new Intl.NumberFormat('id-ID').format(Number(formData.deposit)) : ''} onChange={e => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          setFormData({...formData, deposit: rawValue});
                        }} className="w-full pl-9 pr-3 py-1.5 text-sm font-bold text-brand-navy border border-gray-300 rounded-lg outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all" />
                      </div>
                    ) : (
                      <p className="font-bold text-brand-navy">{formatCurrency(contract.deposit)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2 items-center">
                  <p className="text-sm font-medium text-gray-600">Jatuh tempo pembayaran setiap <span className="font-bold text-brand-navy">Tanggal {contract.payment_due_day}</span> per bulannya. <span className="text-[10px] text-gray-400 font-normal uppercase ml-1">(Terkunci)</span></p>
                </div>
              </div>

              <div className="mt-6 bg-brand-teal/5 border border-brand-teal/20 rounded-xl p-6 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Harga yang Harus Dibayar</p>
                  <p className="text-3xl font-display font-bold text-brand-teal">
                    {formatCurrency(
                      (isEditing ? Number(formData.monthly_rent || 0) : contract.monthly_rent) * 
                      (isEditing ? Number(formData.rental_duration) : contract.rental_duration)
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Catatan Tambahan</p>
                {isEditing ? (
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full bg-white p-4 rounded-xl border border-gray-300 text-sm font-medium text-brand-navy outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all resize-none" placeholder="Masukkan catatan..."></textarea>
                ) : contract.notes ? (
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">{contract.notes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Tidak ada catatan</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
