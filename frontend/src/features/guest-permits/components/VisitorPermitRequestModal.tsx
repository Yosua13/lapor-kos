'use client';

import React, { useState } from 'react';
import { AlertCircle, Calendar, Check, Info, Moon, Sun, User, X } from 'lucide-react';
import type { CreateVisitorPermitInput, VisitorPermit } from '../types';
import { tenantCreateVisitorPermit } from '../api';

interface VisitorPermitRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (permit: VisitorPermit) => void;
}

export function VisitorPermitRequestModal({
  isOpen,
  onClose,
  onSuccess,
}: VisitorPermitRequestModalProps) {
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestIdLast4, setGuestIdLast4] = useState('');
  const [relationship, setRelationship] = useState('Teman');
  const [purpose, setPurpose] = useState('');
  const [isOvernight, setIsOvernight] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [totalGuests, setTotalGuests] = useState(1);
  const [vehicleType, setVehicleType] = useState('tidak_ada');
  const [vehicleNumber, setVehicleNumber] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!guestName.trim()) {
      setError('Nama tamu wajib diisi.');
      return;
    }
    if (!purpose.trim()) {
      setError('Tujuan kunjungan wajib diisi.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Waktu mulai dan waktu selesai kunjungan wajib ditentukan.');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (end <= start) {
      setError('Waktu selesai harus lebih besar dari waktu mulai.');
      return;
    }

    if (!isOvernight) {
      if (end.getHours() > 22 || (end.getHours() === 22 && end.getMinutes() > 0) || end.getDate() !== start.getDate()) {
        setError('Kunjungan tanpa menginap maksimal hingga pukul 22:00 WIB di hari yang sama. Silakan aktifkan opsi "Menginap" jika kunjungan lewat dari jam 22:00.');
        return;
      }
    } else {
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      if (durationHours > 73) {
        setError('Durasi menginap tamu melebihi batas maksimal 3 hari berturut-turut (72 jam) sesuai peraturan kos.');
        return;
      }
    }

    const payload: CreateVisitorPermitInput = {
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim() || undefined,
      guest_id_card_last4: guestIdLast4.trim() || undefined,
      relationship,
      purpose: purpose.trim(),
      is_overnight: isOvernight,
      start_time: startTime,
      end_time: endTime,
      total_guests: Number(totalGuests),
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber.trim() || undefined,
    };

    setIsLoading(true);
    try {
      const created = await tenantCreateVisitorPermit(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal mengajukan izin tamu. Pastikan kontrak Anda masih aktif dan tanggal tidak melewati masa sewa.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Ajukan Izin Tamu / Kerabat
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Isi data kunjungan tamu untuk ditinjau oleh pengelola kos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Pengajuan Gagal</p>
              <p className="mt-0.5 text-xs">{error}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nama Lengkap Tamu <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hubungan / Relasi <span className="text-red-500">*</span>
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Keluarga">Keluarga (Orang Tua / Saudara Kandung)</option>
                <option value="Kerabat">Kerabat</option>
                <option value="Teman">Teman</option>
                <option value="Rekan Kerja">Rekan Kerja</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Nomor Telepon Tamu (Opsional)
              </label>
              <input
                type="text"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                placeholder="081234567890"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                4 Digit Terakhir Tanda Pengenal (KTP/SIM)
              </label>
              <input
                type="text"
                maxLength={4}
                value={guestIdLast4}
                onChange={(e) => setGuestIdLast4(e.target.value)}
                placeholder="Misal: 1234 (Verifikasi Pos Satpam)"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tujuan Kunjungan <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Jelaskan keperluan kunjungan atau menginap secara singkat..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Overnight Stay Toggle & Rule Highlight */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isOvernight ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                  {isOvernight ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isOvernight ? 'Tamu Akan Menginap' : 'Kunjungan Singkat (Non-Menginap)'}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isOvernight
                      ? 'Dikenakan biaya tambahan Rp 50.000/malam (maks. 3 malam berturut-turut).'
                      : 'Batas kunjungan maksimal hingga pukul 22:00 WIB.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOvernight(!isOvernight)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isOvernight ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isOvernight ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Waktu Kedatangan (Mulai) <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Waktu Kepulangan (Selesai) <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Jumlah Tamu (Maks. 3)
              </label>
              <input
                type="number"
                min={1}
                max={3}
                value={totalGuests}
                onChange={(e) => setTotalGuests(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Kendaraan Tamu
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="tidak_ada">Tanpa Kendaraan</option>
                <option value="motor">Sepeda Motor</option>
                <option value="mobil">Mobil</option>
                <option value="lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Plat Nomor Kendaraan
              </label>
              <input
                type="text"
                disabled={vehicleType === 'tidak_ada'}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
                placeholder="B 1234 ABC"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 disabled:opacity-50 focus:border-cyan-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <Info className="h-4 w-4 flex-shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span>
              Waktu kunjungan/menginap wajib berada dalam masa aktif kontrak sewa kamar Anda.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-cyan-700 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Mengirimkan...
                </>
              ) : (
                'Kirim Pengajuan Izin'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
