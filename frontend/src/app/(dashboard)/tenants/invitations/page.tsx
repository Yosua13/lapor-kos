'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';

type DeliveryMethod = 'email' | 'whatsapp';
type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type Invitation = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  delivery_method: DeliveryMethod;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
};
type Notice = { type: 'success' | 'warning' | 'error'; title: string; detail: string };

const formatPhoneNumber = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits && !digits.startsWith('62')) digits = `62${digits}`;
  digits = digits.slice(0, 14);
  if (digits.length <= 2) return digits ? '+62' : '';
  const rest = digits.slice(2);
  return `+62 ${rest.slice(0, 3)}${rest.length > 3 ? `-${rest.slice(3, 7)}` : ''}${rest.length > 7 ? `-${rest.slice(7, 12)}` : ''}`;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const statusPresentation: Record<InvitationStatus, { label: string; dot: string; badge: string }> = {
  pending: { label: 'Menunggu aktivasi', dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700' },
  accepted: { label: 'Aktif', dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700' },
  expired: { label: 'Kedaluwarsa', dot: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600' },
  revoked: { label: 'Dicabut', dot: 'bg-red-500', badge: 'bg-red-50 text-red-600' },
};

export default function TenantInvitationsPage() {
  const { can } = useAuthorization();
  const canManageInvitations = can(CAPABILITIES.TENANT_WRITE);
  const [items, setItems] = useState<Invitation[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | InvitationStatus>('all');
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const load = () => apiFetch<Invitation[]>('/api/tenant-invitations')
    .then(setItems)
    .catch((err: Error) => setNotice({
      type: 'error', title: 'Daftar undangan tidak dapat dimuat', detail: err.message,
    }));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const suggestedName = params.get('name');
    const suggestedEmail = params.get('email');
    const suggestedPhone = params.get('phone');
    if (suggestedName) setFullName(suggestedName);
    if (suggestedEmail) setEmail(suggestedEmail);
    if (suggestedPhone) setPhone(formatPhoneNumber(suggestedPhone));
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => { setCurrentPage(1); }, [activeTab, search, itemsPerPage]);

  const stats = useMemo(() => ({
    all: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    accepted: items.filter((item) => item.status === 'accepted').length,
    expired: items.filter((item) => item.status === 'expired').length,
  }), [items]);

  const visibleItems = useMemo(() => items.filter((item) => (
    (activeTab === 'all' || item.status === activeTab)
    && `${item.full_name} ${item.email} ${item.phone}`.toLowerCase().includes(search.toLowerCase())
  )), [activeTab, items, search]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const pageStart = (page - 1) * itemsPerPage;
  const paginatedItems = visibleItems.slice(pageStart, pageStart + itemsPerPage);
  const pageEnd = Math.min(pageStart + itemsPerPage, visibleItems.length);

  function validate() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = 'Nama lengkap wajib diisi.';
    if (!email.trim()) next.email = 'Email wajib diisi.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Format email tidak valid.';
    const digits = phone.replace(/\D/g, '');
    if (!phone) next.phone = 'Nomor WhatsApp wajib diisi.';
    else if (digits.length < 11 || digits.length > 14) next.phone = 'Gunakan nomor Indonesia yang valid, misalnya +62 812-3456-7890.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await apiFetch<{ delivery: { method: DeliveryMethod; status: 'sent' | 'failed' } }>('/api/tenant-invitations', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(), email: email.trim(), phone, delivery_method: deliveryMethod, expires_in_hours: 72,
        }),
      });
      setFullName('');
      setEmail('');
      setPhone('');
      setErrors({});
      setIsFormOpen(false);
      load();
      const channel = response.delivery.method === 'email' ? 'email' : 'WhatsApp';
      setNotice(response.delivery.status === 'sent'
        ? { type: 'success', title: 'Undangan berhasil dikirim', detail: `Tautan aktivasi telah dikirim melalui ${channel}.` }
        : { type: 'warning', title: 'Undangan dibuat, tetapi belum terkirim', detail: `Periksa konfigurasi ${channel}, lalu cabut dan buat ulang invitation ini.` });
    } catch (err) {
      setNotice({ type: 'error', title: 'Undangan gagal dibuat', detail: err instanceof Error ? err.message : 'Silakan coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!pendingRevoke) return;
    setBusy(true);
    try {
      await apiFetch(`/api/tenant-invitations/${pendingRevoke.id}`, { method: 'DELETE' });
      setNotice({ type: 'success', title: 'Undangan dicabut', detail: `${pendingRevoke.full_name} tidak lagi dapat memakai tautan sebelumnya.` });
      load();
    } catch (err) {
      setNotice({ type: 'error', title: 'Undangan tidak dapat dicabut', detail: err instanceof Error ? err.message : 'Silakan coba lagi.' });
    } finally {
      setBusy(false);
      setPendingRevoke(null);
    }
  }

  const tabs: Array<{ id: 'all' | InvitationStatus; label: string; icon: typeof Users; count: number }> = [
    { id: 'all', label: 'Semua', icon: Users, count: stats.all },
    { id: 'pending', label: 'Menunggu', icon: Clock3, count: stats.pending },
    { id: 'accepted', label: 'Aktif', icon: CheckCircle2, count: stats.accepted },
    { id: 'expired', label: 'Kedaluwarsa', icon: CalendarClock, count: stats.expired },
  ];

  return <div className="-mt-4 flex min-h-[calc(100vh-80px)] w-full flex-col animate-slide-up lg:-mt-8 lg:min-h-[calc(100vh-120px)]">
    <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
      <div>
        <Link href="/tenants" className="text-sm font-bold text-brand-teal hover:underline">&larr; Penghuni & Kontrak</Link>
        <h1 className="mt-2 text-[28px] font-extrabold text-brand-navy">Undangan calon penghuni</h1>
        <p className="mt-1 text-[15px] text-gray-500">Pantau aktivasi akun calon penghuni dalam satu tempat.</p>
      </div>
      {canManageInvitations && <button onClick={() => setIsFormOpen((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-[13px] font-bold text-white shadow-lg shadow-brand-teal/20">
        <UserPlus className="h-4 w-4" />{isFormOpen ? 'Tutup form' : 'Buat undangan'}
      </button>}
    </div>

    {notice && <div role="status" className={`mb-5 flex gap-3 rounded-2xl border p-4 shadow-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : notice.type === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1"><p className="font-bold">{notice.title}</p><p className="mt-1 text-sm opacity-80">{notice.detail}</p></div>
      <button type="button" onClick={() => setNotice(null)} aria-label="Tutup notifikasi"><X className="h-5 w-5" /></button>
    </div>}

    {canManageInvitations && isFormOpen && <form noValidate onSubmit={create} className="mb-6 rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm lg:p-6">
      <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-brand-teal"><Send className="h-5 w-5" /></div><div><h2 className="font-bold text-brand-navy">Kirim undangan baru</h2><p className="text-xs text-gray-500">Lengkapi kontak calon penghuni, lalu pilih kanal pengiriman tautan.</p></div></div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-bold text-brand-navy md:col-span-2">Nama lengkap<input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Contoh: Yosua Rey" className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-brand-teal ${errors.fullName ? 'border-red-400' : 'border-gray-200'}`} /></label>
        {errors.fullName && <p className="-mt-3 text-sm text-red-600 md:col-span-2">{errors.fullName}</p>}
        <label className="block text-sm font-bold text-brand-navy">Alamat email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-brand-teal ${errors.email ? 'border-red-400' : 'border-gray-200'}`} />{errors.email && <span className="mt-1 block text-sm font-normal text-red-600">{errors.email}</span>}</label>
        <label className="block text-sm font-bold text-brand-navy">Nomor WhatsApp<input inputMode="tel" value={phone} onChange={(event) => setPhone(formatPhoneNumber(event.target.value))} placeholder="+62 812-3456-7890" className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-brand-teal ${errors.phone ? 'border-red-400' : 'border-gray-200'}`} /><span className="mt-1 block text-xs font-normal text-gray-500">Format otomatis: +62 812-3456-7890</span>{errors.phone && <span className="mt-1 block text-sm font-normal text-red-600">{errors.phone}</span>}</label>
        <div className="md:col-span-2"><p className="mb-2 text-sm font-bold text-brand-navy">Kirim tautan aktivasi melalui</p><div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setDeliveryMethod('email')} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${deliveryMethod === 'email' ? 'border-brand-teal bg-teal-50' : 'border-gray-200 bg-white hover:border-brand-teal/50'}`}><Mail className="h-5 w-5 text-brand-teal" /><span><b className="block text-sm">Email</b><small className="text-xs text-gray-500">Ke alamat yang diisi di atas</small></span></button>
          <button type="button" onClick={() => setDeliveryMethod('whatsapp')} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${deliveryMethod === 'whatsapp' ? 'border-brand-teal bg-teal-50' : 'border-gray-200 bg-white hover:border-brand-teal/50'}`}><MessageCircle className="h-5 w-5 text-brand-teal" /><span><b className="block text-sm">WhatsApp</b><small className="text-xs text-gray-500">Ke nomor yang diisi di atas</small></span></button>
        </div></div>
      </div>
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-teal/20 disabled:opacity-60"><Send className="h-4 w-4" />{busy ? 'Mengirim...' : `Kirim melalui ${deliveryMethod === 'email' ? 'email' : 'WhatsApp'}`}</button>
    </form>}

    <div className="mb-6 flex flex-wrap items-center gap-3">{tabs.map((tab) => {
      const Icon = tab.icon;
      const selected = activeTab === tab.id;
      return <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 rounded-[10px] border px-4 py-2 text-[13px] font-bold transition-all ${selected ? 'border-emerald-200 bg-emerald-50 text-brand-teal' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}><Icon className="h-4 w-4" />{tab.label}<span className={`rounded-md px-2 py-0.5 text-[11px] ${selected ? 'bg-emerald-100 text-brand-teal' : 'bg-gray-100 text-gray-600'}`}>{tab.count}</span></button>;
    })}</div>

    <section className="flex-1 overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
        <div><h2 className="font-bold text-brand-navy">Daftar calon penghuni</h2><p className="mt-1 text-xs text-gray-500">Status dan riwayat invitation pada properti aktif.</p></div>
        <div className="flex w-full items-center gap-3 lg:w-auto"><div className="relative w-full lg:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, email, nomor..." className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-[13px] outline-none focus:border-brand-teal" /></div><button onClick={load} aria-label="Muat ulang daftar" className="rounded-xl border border-gray-200 p-2.5 text-gray-500 transition-colors hover:bg-gray-50"><RefreshCw className="h-4 w-4" /></button></div>
      </div>
      <div className="overflow-x-auto bg-slate-50 px-5 pb-5 lg:px-7">
        {visibleItems.length === 0 ? <div className="my-5 flex min-h-64 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center"><div className="rounded-2xl bg-gray-50 p-4 text-gray-400"><Users className="h-7 w-7" /></div><h3 className="mt-4 font-bold text-brand-navy">{items.length === 0 ? 'Belum ada undangan' : 'Tidak ada undangan yang sesuai'}</h3><p className="mt-1 max-w-sm text-sm text-gray-500">{items.length === 0 ? 'Buat undangan baru untuk mengirim tautan aktivasi kepada calon penghuni.' : 'Ubah kata kunci pencarian atau filter untuk melihat data lainnya.'}</p></div> : <>
          <table className="w-full min-w-[900px] border-separate border-spacing-y-4 text-left"><thead><tr className="text-[12px] font-bold text-gray-500"><th className="px-5 pb-1 pt-5">CALON PENGHUNI</th><th className="px-5 pb-1 pt-5">KONTAK</th><th className="px-5 pb-1 pt-5">KANAL</th><th className="px-5 pb-1 pt-5">KEDALUWARSA</th><th className="px-5 pb-1 pt-5">STATUS</th><th className="px-5 pb-1 pt-5 text-center">AKSI</th></tr></thead><tbody>{paginatedItems.map((item) => {
            const presentation = statusPresentation[item.status];
            const initials = item.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
            return <tr key={item.id} className="group"><td className="rounded-l-2xl border-y border-l border-gray-200 bg-white px-5 py-4"><div className="flex items-center gap-3"><div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal/10 font-bold text-brand-teal">{initials || '?'}<span className={`absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-white ${presentation.dot}`} /></div><div><p className="font-bold text-brand-navy">{item.full_name}</p><p className="mt-0.5 text-xs text-gray-500">Dibuat {formatDate(item.created_at)}</p></div></div></td><td className="border-y border-gray-200 bg-white px-5 py-4"><p className="text-sm font-medium text-gray-700">{item.email}</p><p className="mt-1 text-xs text-gray-500">{item.phone}</p></td><td className="border-y border-gray-200 bg-white px-5 py-4"><span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">{item.delivery_method === 'email' ? <Mail className="h-4 w-4 text-brand-teal" /> : <MessageCircle className="h-4 w-4 text-brand-teal" />}{item.delivery_method === 'email' ? 'Email' : 'WhatsApp'}</span></td><td className="border-y border-gray-200 bg-white px-5 py-4"><p className="text-sm font-medium text-gray-700">{formatDate(item.expires_at)}</p><p className="mt-1 text-xs text-gray-400">Berlaku 72 jam</p></td><td className="border-y border-gray-200 bg-white px-5 py-4"><span className={`inline-flex rounded-lg px-3 py-1 text-[11px] font-bold ${presentation.badge}`}>{presentation.label}</span></td><td className="rounded-r-2xl border-y border-r border-gray-200 bg-white px-5 py-4 text-center">{canManageInvitations && item.status === 'pending' ? <button onClick={() => setPendingRevoke(item)} className="rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-50">Cabut</button> : <span className="text-xs font-medium text-gray-400">—</span>}</td></tr>;
          })}</tbody></table>
          <div className="mt-2 flex flex-col gap-4 px-1 py-3 text-[13px] text-gray-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <p>Menampilkan <b className="text-brand-navy">{pageStart + 1}</b> - <b className="text-brand-navy">{pageEnd}</b> dari <b className="text-brand-navy">{visibleItems.length}</b> undangan</p>
              <label className="flex items-center gap-2">Tampilkan:
                <select value={itemsPerPage} onChange={(event) => setItemsPerPage(Number(event.target.value))} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-bold text-brand-navy shadow-sm outline-none transition-colors focus:border-brand-teal">
                  <option value={5}>5</option><option value={10}>10</option><option value={25}>25</option>
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCurrentPage((value) => Math.max(1, value - 1))} disabled={page === 1} aria-label="Halaman sebelumnya" className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
              <span aria-current="page" className="grid h-10 min-w-10 place-items-center rounded-xl bg-brand-teal px-3 font-bold text-white shadow-sm shadow-brand-teal/30">{page}</span>
              <button type="button" onClick={() => setCurrentPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} aria-label="Halaman berikutnya" className="grid h-10 w-10 place-items-center rounded-xl border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </>}
      </div>
    </section>

    {pendingRevoke && <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><ShieldAlert className="h-8 w-8 text-amber-500" /><h2 className="mt-3 text-xl font-bold">Cabut undangan?</h2><p className="mt-2 text-slate-600">{pendingRevoke.full_name} tidak akan dapat mengaktifkan akun dari tautan yang sudah diterima.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setPendingRevoke(null)} className="rounded-xl px-4 py-2 font-semibold text-slate-600">Batal</button><button disabled={busy} onClick={revoke} className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white disabled:opacity-60">Cabut undangan</button></div></div></div>}
  </div>;
}
