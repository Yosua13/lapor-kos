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
  X
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
    <div className="space-y-8 animate-fade-up">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-navy">Manajemen Kamar</h1>
          <p className="text-text-mid mt-1">Kelola ketersediaan dan informasi kamar kos Anda.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-teal hover:bg-teal-light text-white font-semibold px-5 py-3 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center gap-2 w-fit"
        >
          <Plus className="w-5 h-5" />
          <span>Tambah Kamar</span>
        </button>
      </header>

      {/* Filter & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 bg-white px-4 py-2 rounded-2xl border border-gray-100 flex items-center gap-3 focus-within:border-teal/50 transition-all">
          <Search className="w-5 h-5 text-text-muted" />
          <input 
            type="text" 
            placeholder="Cari nomor kamar..." 
            className="bg-transparent border-none w-full focus:outline-none text-navy py-2"
          />
        </div>
        <select className="bg-white px-4 py-3 rounded-2xl border border-gray-100 text-navy font-medium focus:outline-none focus:border-teal/50 transition-all">
          <option value="all">Semua Status</option>
          <option value="available">Tersedia</option>
          <option value="occupied">Terisi</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-cream/50 border-b border-gray-100">
                <th className="px-6 py-5 text-xs font-bold text-text-muted uppercase tracking-wider">Nomor Kamar</th>
                <th className="px-6 py-5 text-xs font-bold text-text-muted uppercase tracking-wider">Harga/Bulan</th>
                <th className="px-6 py-5 text-xs font-bold text-text-muted uppercase tracking-wider">Fasilitas/Deskripsi</th>
                <th className="px-6 py-5 text-xs font-bold text-text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-5 text-xs font-bold text-text-muted uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-teal mx-auto mb-4" />
                    <p className="text-text-muted">Memuat data kamar...</p>
                  </td>
                </tr>
              ) : rooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-cream rounded-full flex items-center justify-center mx-auto mb-4">
                      <DoorOpen className="w-8 h-8 text-text-muted" />
                    </div>
                    <p className="text-navy font-semibold">Belum ada kamar</p>
                    <p className="text-text-muted text-sm mt-1">Klik tombol "Tambah Kamar" untuk memulai.</p>
                  </td>
                </tr>
              ) : (
                rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-cream/20 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-navy/5 rounded-xl flex items-center justify-center font-bold text-navy">
                          {room.room_number}
                        </div>
                        <span className="font-semibold text-navy">Kamar {room.room_number}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span className="font-medium text-navy">Rp {room.price_per_month.toLocaleString('id-ID')}</span>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm text-text-mid line-clamp-1 max-w-[200px]">{room.description || '-'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <StatusBadge status={room.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenModal(room)}
                          className="p-2 text-text-muted hover:text-teal hover:bg-teal/5 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(room.id)}
                          className="p-2 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-[500px] w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-text-muted hover:text-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h3 className="font-serif text-2xl text-navy mb-2">
              {editingRoom ? 'Edit Kamar' : 'Tambah Kamar Baru'}
            </h3>
            <p className="text-text-mid text-sm mb-8">
              Lengkapi informasi kamar di bawah ini.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Nomor Kamar</label>
                  <input 
                    type="text" 
                    required
                    value={formData.room_number}
                    onChange={(e) => setFormData({...formData, room_number: e.target.value})}
                    placeholder="Contoh: 101"
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-navy ml-1">Harga/Bulan</label>
                  <input 
                    type="number" 
                    required
                    value={formData.price_per_month}
                    onChange={(e) => setFormData({...formData, price_per_month: e.target.value})}
                    placeholder="1500000"
                    className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-navy ml-1">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3 px-4 text-navy focus:outline-none focus:border-teal transition-all"
                >
                  <option value="available">Tersedia</option>
                  <option value="occupied">Terisi</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-navy ml-1">Deskripsi/Fasilitas</label>
                <textarea 
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Contoh: Kamar mandi dalam, AC, Wifi..."
                  className="w-full bg-cream/30 border border-gray-100 rounded-xl py-3 px-4 text-navy focus:outline-none focus:border-teal transition-all resize-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-cream hover:bg-gray-200 text-navy font-semibold py-4 rounded-xl transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-[2] bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>{editingRoom ? 'Simpan Perubahan' : 'Tambah Kamar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
