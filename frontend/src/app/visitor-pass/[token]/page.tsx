'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DoorOpen,
  HelpCircle,
  Moon,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sun,
  User,
  XCircle,
} from 'lucide-react';
import { verifyVisitorPass } from '@/features/guest-permits/api';
import type { VisitorPassVerification } from '@/features/guest-permits/types';
import { formatDateRange, formatVehicle } from '@/features/guest-permits/format';

export default function VisitorPassVerificationPage() {
  const params = useParams();
  const token = params?.token as string;

  const [pass, setPass] = useState<VisitorPassVerification | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token pass tidak ditemukan.');
      setIsLoading(false);
      return;
    }

    const checkPass = async () => {
      setIsLoading(true);
      try {
        const data = await verifyVisitorPass(token);
        setPass(data);
      } catch (err: any) {
        setError(err?.message || 'Pass tamu tidak ditemukan atau sudah kedaluwarsa.');
      } finally {
        setIsLoading(false);
      }
    };

    checkPass();
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl text-white">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Lapor Kos &bull; Gate Pass
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-cyan-400">{token || '-'}</span>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">
              <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-500 mb-3" />
              <p>Memverifikasi kode pass di sistem...</p>
            </div>
          ) : error || !pass ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
                <XCircle className="h-10 w-10" />
              </div>
              <h3 className="mt-4 text-lg font-black text-white">Pass Tidak Valid</h3>
              <p className="mt-1 text-xs text-slate-400 px-4">
                {error || 'Kode pass tidak terdaftar pada sistem perizinan tamu aktif.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Status Banner */}
              {pass.is_overstay ? (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 ring-1 ring-rose-500/20 animate-pulse">
                  <AlertTriangle className="h-6 w-6 flex-shrink-0 text-rose-400" />
                  <div>
                    <h4 className="text-sm font-bold">PERINGATAN: OVERSTAY</h4>
                    <p className="text-xs text-rose-300/80">
                      Waktu izin kunjungan telah berakhir. Tamu harus segera check-out.
                    </p>
                  </div>
                </div>
              ) : pass.is_valid ? (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold">PASS VALID & DISETUJUI</h4>
                    <p className="text-xs text-emerald-300/80">
                      Tamu terverifikasi dan diizinkan berkunjung/menginap.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-300 ring-1 ring-amber-500/20">
                  <Clock className="h-6 w-6 flex-shrink-0 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold">STATUS: {pass.status.toUpperCase()}</h4>
                    <p className="text-xs text-amber-300/80">
                      Kunjungan belum aktif atau telah diselesaikan.
                    </p>
                  </div>
                </div>
              )}

              {/* Property & Room Tag */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{pass.property_name || 'Kost'}</span>
                </div>
                <h2 className="mt-1 text-3xl font-black text-white">
                  Kamar {pass.room_number || '-'}
                </h2>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {pass.is_overnight ? <Moon className="h-3 w-3 text-indigo-400" /> : <Sun className="h-3 w-3 text-amber-400" />}
                  <span>{pass.is_overnight ? 'Menginap' : 'Kunjungan Singkat'}</span>
                </div>
              </div>

              {/* Minimal Sanitized Guest Details */}
              <div className="space-y-2.5 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Inisial Tamu:</span>
                  <span className="font-bold text-slate-200">{pass.guest_name_masked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hubungan:</span>
                  <span className="font-medium text-slate-200">{pass.relationship}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Jumlah Orang:</span>
                  <span className="font-medium text-slate-200">{pass.total_guests} orang</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kendaraan:</span>
                  <span className="font-medium text-slate-200">
                    {formatVehicle(pass.vehicle_type, pass.vehicle_number || undefined)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Masa Berlaku:</span>
                  <span className="font-medium text-right text-slate-200">
                    {formatDateRange(pass.start_time, pass.end_time, pass.is_overnight)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Keperluan:</span>
                  <span className="font-medium text-right text-slate-200 max-w-[200px]">
                    {pass.purpose}
                  </span>
                </div>
              </div>

              {/* Notice */}
              <div className="rounded-xl bg-slate-900/30 p-3 text-[11px] text-slate-400 text-center leading-relaxed">
                Tamu wajib mematuhi seluruh peraturan kos, menjaga kebersihan, dan tenang setelah jam malam (22:00 WIB).
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 bg-slate-900/60 px-6 py-3 text-center text-[10px] text-slate-500">
          Sistem Verifikasi Izin Tamu &bull; Lapor Kos Platform
        </div>
      </div>
    </div>
  );
}
