'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { 
  ArrowLeft, Calendar, Check, DoorOpen,
  Banknote, AlertTriangle, Loader2 
} from 'lucide-react';
import Link from 'next/link';

export default function NewContractPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    room_id: '',
    tenant_id: '',
    start_date: new Date().toISOString().split('T')[0],
    rental_duration: 1,
    monthly_rent: '',
    deposit: '0',
    payment_due_day: '',
    notes: ''
  });

  useEffect(() => {
    if (formData.start_date) {
      const start = new Date(formData.start_date);
      const nextMonth = new Date(start);
      nextMonth.setMonth(start.getMonth() + 1);
      nextMonth.setDate(nextMonth.getDate() - 3);
      const dueDay = nextMonth.getDate();

      setFormData(prev => ({
        ...prev,
        payment_due_day: dueDay.toString(),
        notes: `Perpanjangan kontrak dilakukan paling lambat pada tanggal ${dueDay}`
      }));
    }
  }, [formData.start_date]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [roomsData, tenantsData] = await Promise.all([
          apiFetch('/api/rooms'),
          apiFetch('/api/tenants')
        ]);
        setRooms((roomsData || []).filter((r: any) => r.status === 'available'));
        setTenants((tenantsData || []).filter((t: any) => !t.room_id));
      } catch (err: any) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const handleRoomSelect = (roomId: string) => {
    const room = rooms.find(r => r.id === roomId);
    setFormData({
      ...formData,
      room_id: roomId,
      monthly_rent: room ? room.price_per_month.toString() : ''
    });
  };

  const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    let val = e.target.value.replace(/\D/g, '');
    setFormData({ ...formData, [field]: val });
  };

  const formatRupiah = (val: string) => {
    if (!val) return '';
    return new Intl.NumberFormat('id-ID').format(Number(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_id || !formData.tenant_id || !formData.start_date || !formData.monthly_rent) {
      alert('Harap lengkapi semua field yang wajib.');
      return;
    }

    setIsSubmitting(true);
    try {
      const start = new Date(formData.start_date);
      const end = new Date(start);
      end.setMonth(start.getMonth() + formData.rental_duration);
      const end_date = end.toISOString().split('T')[0];

      await apiFetch('/api/contracts', {
        method: 'POST',
        body: JSON.stringify({
          room_id: formData.room_id,
          tenant_id: formData.tenant_id,
          start_date: formData.start_date,
          end_date: end_date,
          monthly_rent: parseFloat(formData.monthly_rent),
          deposit: parseFloat(formData.deposit) || 0,
          payment_due_day: parseInt(formData.payment_due_day) || 1,
          notes: formData.notes
        })
      });
      router.push('/contracts');
    } catch (err: any) {
      alert(err.message || 'Gagal membuat kontrak');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up pb-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/contracts" className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:text-brand-teal hover:border-brand-teal transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-bold text-brand-navy">Buat Kontrak Baru</h1>
          <p className="text-sm text-gray-500 mt-1">Lengkapi form di bawah untuk membuat kontrak sewa baru</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border-[1.5px] border-gray-200 rounded-[24px] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-gray-100">
          <h2 className="text-lg font-bold text-brand-navy mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center"><DoorOpen className="w-4 h-4" /></span>
            Pilih Kamar & Penghuni
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kamar Kos <span className="text-red-500">*</span></label>
              <select 
                value={formData.room_id}
                onChange={(e) => handleRoomSelect(e.target.value)}
                className="w-full bg-gray-50 border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:bg-white focus:border-brand-teal transition-colors"
                required
              >
                <option value="">-- Pilih Kamar Tersedia --</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>Kamar {room.room_number} (Rp {formatRupiah(room.price_per_month.toString())})</option>
                ))}
              </select>
              {rooms.length === 0 && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Tidak ada kamar kosong.</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Penghuni <span className="text-red-500">*</span></label>
              <select 
                value={formData.tenant_id}
                onChange={(e) => setFormData({...formData, tenant_id: e.target.value})}
                className="w-full bg-gray-50 border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:bg-white focus:border-brand-teal transition-colors"
                required
              >
                <option value="">-- Pilih Penghuni Terdaftar --</option>
                {tenants.map(tenant => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name} - {tenant.phone}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-8 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-brand-navy mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center"><Calendar className="w-4 h-4" /></span>
            Periode Sewa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Mulai <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Durasi Sewa <span className="text-red-500">*</span></label>
              <select 
                value={formData.rental_duration}
                onChange={(e) => setFormData({...formData, rental_duration: parseInt(e.target.value)})}
                className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
                required
              >
                <option value={1}>1 Bulan</option>
                <option value={3}>3 Bulan</option>
                <option value={6}>6 Bulan</option>
                <option value={12}>12 Bulan (1 Tahun)</option>
              </select>
              {formData.start_date && (
                <p className="text-xs text-brand-teal font-medium mt-1">
                  Tanggal Berakhir: {
                    (() => {
                      const end = new Date(formData.start_date);
                      end.setMonth(end.getMonth() + formData.rental_duration);
                      return end.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                    })()
                  }
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="p-8">
          <h2 className="text-lg font-bold text-brand-navy mb-6 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center"><Banknote className="w-4 h-4" /></span>
            Rincian Keuangan
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sewa Bulanan (Rp) <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</span>
                <input 
                  type="text" 
                  value={formatRupiah(formData.monthly_rent)}
                  readOnly
                  disabled
                  className="w-full bg-gray-50 border-[1.5px] border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-gray-500 cursor-not-allowed"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Deposit (Rp)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">Rp</span>
                <input 
                  type="text" 
                  value={formatRupiah(formData.deposit)}
                  onChange={(e) => handleMoneyChange(e, 'deposit')}
                  className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal Jatuh Tempo <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Setiap tanggal</span>
                <input 
                  type="number" 
                  min="1" max="31"
                  value={formData.payment_due_day}
                  onChange={(e) => setFormData({...formData, payment_due_day: e.target.value})}
                  className="w-20 bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-center text-sm font-bold text-brand-navy focus:outline-none focus:border-brand-teal transition-colors"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Catatan Tambahan</label>
              <textarea 
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full bg-white border-[1.5px] border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-brand-navy focus:outline-none focus:border-brand-teal transition-colors resize-none"
                placeholder="Catatan opsional..."
              ></textarea>
            </div>
          </div>
          
          <div className="mt-6 bg-brand-teal/5 border border-brand-teal/20 rounded-xl p-5 flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Harga (Sewa x Durasi)</p>
              <p className="text-2xl font-display font-bold text-brand-teal">
                Rp {formatRupiah((Number(formData.monthly_rent.replace(/\D/g, '') || 0) * formData.rental_duration).toString())}
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
          <Link href="/contracts" className="px-6 py-3 border border-gray-200 text-brand-navy font-bold text-sm rounded-xl hover:bg-white hover:border-gray-300 transition-colors">
            Batal
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 py-3 bg-brand-teal text-white font-bold text-sm rounded-xl hover:bg-brand-teal-light transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            {isSubmitting ? 'Memproses...' : 'Simpan Kontrak'}
          </button>
        </div>
      </form>
    </div>
  );
}
