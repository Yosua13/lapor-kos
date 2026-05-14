'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Loader2,
  AlertCircle,
  DoorOpen,
  X,
  ChevronRight
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import StatusBadge from '../../../components/StatusBadge';

interface Room {
  id: string;
  room_number: string;
  price_per_month: number;
  description: string;
  status: string;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    room_number: '',
    price_per_month: '',
    description: '',
    status: 'available'
  });

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch('/api/rooms');
      setRooms(data || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data kamar');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleOpenModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setFormData({
        room_number: room.room_number,
        price_per_month: room.price_per_month.toString(),
        description: room.description,
        status: room.status
      });
    } else {
      setEditingRoom(null);
      setFormData({
        room_number: '',
        price_per_month: '',
        description: '',
        status: 'available'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...formData,
        price_per_month: parseFloat(formData.price_per_month)
      };

      if (editingRoom) {
        await apiFetch(`/api/rooms/${editingRoom.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/rooms', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      
      setIsModalOpen(false);
      fetchRooms();
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kamar ini?')) return;
    
    try {
      await apiFetch(`/api/rooms/${id}`, { method: 'DELETE' });
      fetchRooms();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus kamar');
    }
  };

  return (
    <div className="space-y-8 animate-slide-up max-w-[1400px] mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">DATA INVENTORI</p>
          <h1 className="text-4xl font-display font-bold text-brand-navy">Manajemen Kamar</h1>
          <p className="text-brand-navy/40 text-sm mt-1">Kelola ketersediaan dan informasi kamar kos Anda.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-teal hover:bg-brand-teal-light text-white text-sm font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-brand-teal/30 transition-all flex items-center gap-2 group w-fit"
        >
          <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
          <span>Tambah Kamar</span>
        </button>
      </header>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 glass-panel px-6 py-1 rounded-[24px] flex items-center gap-3 focus-within:shadow-xl focus-within:shadow-brand-teal/5 transition-all">
          <Search className="w-5 h-5 text-brand-navy/20" />
          <input 
            type="text" 
            placeholder="Cari nomor kamar..." 
            className="bg-transparent border-none w-full focus:outline-none text-brand-navy font-medium py-3.5 placeholder:text-brand-navy/20"
          />
        </div>
        <select className="glass-panel px-6 py-3.5 rounded-[24px] text-brand-navy font-bold text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/20 transition-all appearance-none cursor-pointer">
          <option value="all">SEMUA STATUS</option>
          <option value="available">TERSEDIA</option>
          <option value="occupied">TERISI</option>
        </select>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-[40px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-brand-navy/5">
                <th className="px-8 py-6 text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Nomor Kamar</th>
                <th className="px-8 py-6 text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Harga/Bulan</th>
                <th className="px-8 py-6 text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Deskripsi</th>
                <th className="px-8 py-6 text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-6 text-[10px] font-bold text-brand-navy/30 uppercase tracking-[0.2em] text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-navy/5">
              {isLoading && rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-brand-teal mx-auto mb-4" />
                    <p className="text-brand-navy/40 font-bold text-xs uppercase tracking-widest">Memuat Data Kamar...</p>
                  </td>
                </tr>
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="w-20 h-20 bg-brand-navy/5 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-brand-navy/10">
                      <DoorOpen className="w-10 h-10" />
                    </div>
                    <p className="text-brand-navy font-bold text-lg">Belum Ada Kamar</p>
                    <p className="text-brand-navy/30 text-sm mt-1">Mulai kelola kos Anda dengan menambahkan kamar pertama.</p>
                  </td>
                </tr>
              ) : (
                rooms.map((room, i) => (
                  <tr 
                    key={room.id} 
                    className="hover:bg-brand-cream/50 transition-colors group ledger-border animate-slide-up"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-navy/5 rounded-2xl flex items-center justify-center font-bold text-brand-navy group-hover:bg-brand-teal group-hover:text-white transition-all duration-300">
                          {room.room_number.slice(-2)}
                        </div>
                        <div>
                           <p className="font-bold text-brand-navy">Kamar {room.room_number}</p>
                           <p className="text-[10px] text-brand-navy/30 uppercase tracking-widest font-bold">Standard Unit</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className="font-bold text-brand-navy">Rp {room.price_per_month.toLocaleString('id-ID')}</span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-sm text-brand-navy/60 line-clamp-1 max-w-[250px]">{room.description || '-'}</p>
                    </td>
                    <td className="px-8 py-6">
                       <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                         room.status === 'occupied' 
                           ? 'bg-brand-teal/10 text-brand-teal animate-pulse-teal' 
                           : 'bg-amber-500/10 text-amber-600'
                       }`}>
                          {room.status === 'occupied' ? 'TERISI' : 'KOSONG'}
                       </span>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(room)}
                          className="p-2.5 text-brand-navy/20 hover:text-brand-teal hover:bg-brand-teal/5 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(room.id)}
                          className="p-2.5 text-brand-navy/20 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-navy/40 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="bg-white rounded-[40px] p-10 max-w-[550px] w-full shadow-2xl relative animate-slide-up">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 text-brand-navy/20 hover:text-brand-navy transition-colors p-2"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="mb-10">
               <p className="text-[10px] font-bold text-brand-teal uppercase tracking-[0.3em] mb-1">FORM UNIT</p>
               <h3 className="text-3xl font-display font-bold text-brand-navy">
                 {editingRoom ? 'Perbarui Kamar' : 'Tambah Kamar Baru'}
               </h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Nomor Kamar</label>
                  <input 
                    type="text" 
                    required
                    value={formData.room_number}
                    onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                    placeholder="E.g. 101"
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-semibold focus:ring-2 focus:ring-brand-teal/20 transition-all placeholder:text-brand-navy/10"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Harga (Rp/Bln)</label>
                  <input 
                    type="number" 
                    required
                    value={formData.price_per_month}
                    onChange={(e) => setFormData({...formData, price_per_month: e.target.value})}
                    placeholder="1500000"
                    className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-semibold focus:ring-2 focus:ring-brand-teal/20 transition-all placeholder:text-brand-navy/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Status Ketersediaan</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-bold focus:ring-2 focus:ring-brand-teal/20 transition-all appearance-none cursor-pointer"
                >
                  <option value="available">TERSEDIA (KOSONG)</option>
                  <option value="occupied">TERISI</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-brand-navy/40 uppercase tracking-widest ml-1">Fasilitas & Deskripsi</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Contoh: AC, Wi-Fi, Kamar Mandi Dalam..."
                  className="w-full bg-brand-navy/5 border-none rounded-2xl py-4 px-5 text-brand-navy font-semibold focus:ring-2 focus:ring-brand-teal/20 transition-all resize-none placeholder:text-brand-navy/10"
                />
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-brand-navy/5 hover:bg-brand-navy/10 text-brand-navy font-bold py-4 rounded-2xl transition-all text-sm uppercase tracking-widest"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] bg-brand-teal hover:bg-brand-teal-light text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-teal/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>{editingRoom ? 'Simpan Perubahan' : 'Konfirmasi Data'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
