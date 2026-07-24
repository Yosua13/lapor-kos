'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';

type Invitation = { id: string; full_name: string; email: string; status: string; expires_at: string; created_at: string };

export default function TenantInvitationsPage() {
	const { can } = useAuthorization();
	const canManageInvitations = can(CAPABILITIES.TENANT_WRITE);
  const [items, setItems] = useState<Invitation[]>([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [activationLink, setActivationLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = () => apiFetch<Invitation[]>('/api/tenant-invitations').then(setItems).catch((err: Error) => setError(err.message));
  useEffect(() => { load(); }, []);

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await apiFetch<{ activation_token: string; activation_path: string }>('/api/tenant-invitations', { method: 'POST', body: JSON.stringify({ full_name: fullName, email, phone, expires_in_hours: 72 }) });
      setActivationLink(`${window.location.origin}${response.activation_path}`); setFullName(''); setEmail(''); setPhone(''); load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Tidak dapat membuat undangan.'); } finally { setBusy(false); }
  }
  async function revoke(id: string) { if (!confirm('Cabut undangan ini?')) return; await apiFetch(`/api/tenant-invitations/${id}`, { method: 'DELETE' }); load(); }

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><Link href="/tenants" className="text-sm font-semibold text-brand-teal">← Penghuni & Kontrak</Link><h1 className="mt-2 text-3xl font-bold text-brand-navy">Undangan calon penghuni</h1><p className="mt-1 text-slate-500">Buat profil calon penghuni tanpa membuat kata sandi. Tautan hanya ditampilkan sekali.</p></div>
    {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {canManageInvitations && <form onSubmit={create} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-3">
      <input required placeholder="Nama lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
      <input required type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
      <input placeholder="Nomor telepon" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
      <button disabled={busy} className="md:col-span-3 justify-self-start rounded-lg bg-brand-teal px-4 py-2 font-semibold text-white disabled:opacity-60">{busy ? 'Membuat…' : 'Buat undangan 72 jam'}</button>
    </form>}
    {activationLink && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Salin tautan ini sekarang.</strong><p className="mt-2 break-all select-all">{activationLink}</p></div>}
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-4">Calon penghuni</th><th className="p-4">Status</th><th className="p-4">Kedaluwarsa</th><th className="p-4"></th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-4"><p className="font-semibold">{item.full_name}</p><p className="text-slate-500">{item.email}</p></td><td className="p-4 capitalize">{item.status}</td><td className="p-4">{new Date(item.expires_at).toLocaleString('id-ID')}</td><td className="p-4">{canManageInvitations && item.status === 'pending' && <button onClick={() => revoke(item.id)} className="text-red-600">Cabut</button>}</td></tr>)}{items.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-500">Belum ada undangan.</td></tr>}</tbody></table></section>
  </div>;
}
