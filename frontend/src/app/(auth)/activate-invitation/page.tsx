'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type InvitationPreview = { full_name: string; email: string; expires_at: string };

function ActivateInvitationContent() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [password, setPassword] = useState('');
  const [existingPassword, setExistingPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) { setError('Tautan undangan tidak lengkap.'); setLoading(false); return; }
    apiFetch<InvitationPreview>(`/api/tenant-invitations/${encodeURIComponent(token)}`, { propertyScoped: false })
      .then(setPreview)
      .catch((err: Error) => setError(err.message || 'Undangan tidak tersedia.'))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!agree) { setError('Persetujuan kebijakan diperlukan untuk melanjutkan.'); return; }
    setSubmitting(true); setError('');
    try {
      const result = await apiFetch<{ requires_contact_verification: boolean }>('/api/tenant-invitations/activate', {
        method: 'POST', propertyScoped: false,
        body: JSON.stringify({ token, password, existing_password: existingPassword, policy_version: 'tenant-activation-v1' }),
      });
      setSuccess(result.requires_contact_verification
        ? 'Akun dibuat. Periksa email Anda untuk memverifikasi kontak sebelum masuk.'
        : 'Profil tenant berhasil diaktifkan. Anda dapat masuk menggunakan akun yang ada.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Aktivasi gagal.'); }
    finally { setSubmitting(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center">
    <section className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-sm border border-slate-200">
      <p className="text-sm font-semibold text-brand-teal">Lapor Kos</p>
      <h1 className="mt-2 text-2xl font-bold text-brand-navy">Aktivasi undangan penghuni</h1>
      {loading && <p className="mt-5 text-slate-500">Memeriksa undangan…</p>}
      {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <div className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">{success}<Link href="/login" className="ml-1 font-bold underline">Masuk ke aplikasi</Link></div>}
      {preview && !success && <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700"><p className="font-semibold">{preview.full_name}</p><p>{preview.email}</p><p className="mt-1 text-xs">Berlaku sampai {new Date(preview.expires_at).toLocaleString('id-ID')}.</p></div>
        <label className="block text-sm font-medium text-slate-700">Kata sandi akun baru
          <input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Kata sandi akun yang sudah ada <span className="font-normal text-slate-500">(isi bila email ini telah terdaftar)</span>
          <input type="password" value={existingPassword} onChange={(e) => setExistingPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="flex gap-2 text-sm text-slate-700"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />Saya menyetujui kebijakan dan peraturan kos yang berlaku.</label>
        <button disabled={submitting} className="w-full rounded-lg bg-brand-teal px-4 py-2.5 font-semibold text-white disabled:opacity-60">{submitting ? 'Mengaktifkan…' : 'Aktifkan akun'}</button>
      </form>}
    </section>
  </main>;
}

export default function ActivateInvitationPage() {
  return <Suspense fallback={<main className="min-h-screen bg-slate-50 px-4 py-12 flex items-center justify-center"><p className="text-slate-500">Menyiapkan aktivasi undangan…</p></main>}><ActivateInvitationContent /></Suspense>;
}
