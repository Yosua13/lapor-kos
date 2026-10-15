'use client';

import { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageCircle,
  Moon,
  Clock,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getNotificationPreferences, updateNotificationPreferences } from '../api';
import type { NotificationPreference } from '../types';

export function NotificationPreferencesForm() {
  const [pref, setPref] = useState<NotificationPreference | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  useEffect(() => {
    const fetchPref = async () => {
      try {
        const data = await getNotificationPreferences();
        setPref(data);
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Gagal memuat preferensi' });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPref();
  }, []);

  const handleToggleOptOut = (category: string) => {
    if (!pref) return;
    const exists = pref.opt_out_categories.includes(category);
    const updated = exists
      ? pref.opt_out_categories.filter((c) => c !== category)
      : [...pref.opt_out_categories, category];
    setPref({ ...pref, opt_out_categories: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pref) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const updated = await updateNotificationPreferences({
        email_enabled: pref.email_enabled,
        whatsapp_enabled: pref.whatsapp_enabled,
        in_app_enabled: pref.in_app_enabled,
        quiet_hours_enabled: pref.quiet_hours_enabled,
        quiet_hours_start: pref.quiet_hours_start,
        quiet_hours_end: pref.quiet_hours_end,
        quiet_hours_timezone: pref.quiet_hours_timezone,
        opt_out_categories: pref.opt_out_categories,
      });
      setPref(updated);
      setFeedback({ type: 'success', message: 'Preferensi notifikasi berhasil disimpan!' });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Gagal menyimpan preferensi' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center text-sm text-gray-400">
        Memuat preferensi notifikasi...
      </div>
    );
  }

  if (!pref) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center text-sm text-rose-500">
        Tidak dapat memuat preferensi.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {feedback && (
        <div
          className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Saluran Pengiriman (Channels) */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-brand-teal/10 text-brand-teal">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-brand-navy text-sm">Saluran Pengiriman</h3>
            <p className="text-xs text-gray-500">Pilih media tempat Anda ingin menerima pemberitahuan</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* In-App */}
          <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-brand-teal" />
              <div>
                <p className="text-xs font-bold text-brand-navy">Aplikasi (In-App)</p>
                <p className="text-[11px] text-gray-500">Kotak masuk & lonceng web</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pref.in_app_enabled}
              onChange={(e) => setPref({ ...pref, in_app_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
            />
          </label>

          {/* WhatsApp */}
          <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-brand-navy">WhatsApp</p>
                <p className="text-[11px] text-gray-500">Pesan langsung ke nomor HP</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pref.whatsapp_enabled}
              onChange={(e) => setPref({ ...pref, whatsapp_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
            />
          </label>

          {/* Email */}
          <label className="flex items-center justify-between p-4 rounded-2xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-blue-600" />
              <div>
                <p className="text-xs font-bold text-brand-navy">Email</p>
                <p className="text-[11px] text-gray-500">Surat elektronik berkala</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={pref.email_enabled}
              onChange={(e) => setPref({ ...pref, email_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-teal focus:ring-brand-teal"
            />
          </label>
        </div>
      </div>

      {/* Jam Tenang (Quiet Hours) - AC 5 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-brand-navy text-sm">Jam Tenang (Quiet Hours)</h3>
              <p className="text-xs text-gray-500">
                Tunda pesan eksternal saat jam istirahat agar tidak mengganggu Anda
              </p>
            </div>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={pref.quiet_hours_enabled}
              onChange={(e) => setPref({ ...pref, quiet_hours_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-teal"></div>
          </label>
        </div>

        {pref.quiet_hours_enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-gray-50 animate-slide-up">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Mulai Jam
              </label>
              <input
                type="time"
                value={pref.quiet_hours_start}
                onChange={(e) => setPref({ ...pref, quiet_hours_start: e.target.value })}
                className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-400" />
                Selesai Jam
              </label>
              <input
                type="time"
                value={pref.quiet_hours_end}
                onChange={(e) => setPref({ ...pref, quiet_hours_end: e.target.value })}
                className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Zona Waktu</label>
              <select
                value={pref.quiet_hours_timezone}
                onChange={(e) => setPref({ ...pref, quiet_hours_timezone: e.target.value })}
                className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
              >
                <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
              </select>
            </div>

            <div className="sm:col-span-3 text-[11px] text-gray-500 bg-amber-50/60 border border-amber-200/50 p-3 rounded-xl flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Pesan berprioritas darurat (seperti OTP, peringatan keamanan akun, dan tagihan jatuh tempo kritis) tetap akan dikirimkan demi keamanan operasional hunian Anda.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Kategori Opt-Out - AC 5 */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-brand-navy text-sm">Kategori yang Dilewati (Opt-Out)</h3>
          <p className="text-xs text-gray-500">
            Centang kategori yang tidak ingin Anda terima melalui saluran eksternal (pesan tetap tersimpan di kotak masuk aplikasi)
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            { id: 'announcement', label: 'Pengumuman Komunitas', desc: 'Info kegiatan kos dan pengumuman umum' },
            { id: 'operations', label: 'Info Operasional Rutin', desc: 'Pembaruan kebersihan & jadwal berkala' },
            { id: 'complaint', label: 'Status Komplain Fasilitas', desc: 'Notifikasi perubahan progres tiket perbaikan' },
            { id: 'billing', label: 'Pengingat Tagihan Non-Mendesak', desc: 'Pemberitahuan awal pembuatan invoice' },
          ].map((item) => {
            const isOptedOut = pref.opt_out_categories.includes(item.id);
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-colors cursor-pointer ${
                  isOptedOut
                    ? 'border-amber-300 bg-amber-50/30'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isOptedOut}
                  onChange={() => handleToggleOptOut(item.id)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="text-xs font-bold text-brand-navy">{item.label}</p>
                  <p className="text-[11px] text-gray-500">{item.desc}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-teal text-white font-bold text-xs shadow-md shadow-brand-teal/20 hover:bg-brand-teal/90 transition-all disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </form>
  );
}
