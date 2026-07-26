'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, CircleAlert, LockKeyhole } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type InvitationPreview = {
  full_name: string;
  email: string;
  email_required: boolean;
  expires_at: string;
};
type AccountType = 'new' | 'existing';

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-sm text-red-600">{message}</p> : null;
}

function ActivateInvitationContent() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [email, setEmail] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('new');
  const [password, setPassword] = useState('');
  const [existingPassword, setExistingPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState('');
  const [success, setSuccess] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const displayedRequestError = token ? requestError : 'Tautan undangan tidak lengkap.';

  useEffect(() => {
    if (!token) return;

    apiFetch<InvitationPreview>(`/api/tenant-invitations/${encodeURIComponent(token)}`, { propertyScoped: false })
      .then((data) => {
        setPreview(data);
        setEmail(data.email);
      })
      .catch((err: Error) => setRequestError(err.message || 'Undangan tidak tersedia.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!awaitingVerification || !token) return;

    const checkVerification = async () => {
      try {
        const result = await apiFetch<{ verified: boolean }>(
          `/api/tenant-invitations/activation-status?token=${encodeURIComponent(token)}`,
          { propertyScoped: false },
        );
        if (result.verified) window.location.replace('/login?verified=success');
      } catch {
        // Keep polling while the tenant completes the email verification.
      }
    };

    void checkVerification();
    const interval = window.setInterval(() => void checkVerification(), 3000);
    return () => window.clearInterval(interval);
  }, [awaitingVerification, token]);

  function clearFieldError(field: string) {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) return currentErrors;
      const remainingErrors = { ...currentErrors };
      delete remainingErrors[field];
      return remainingErrors;
    });
  }

  function selectAccountType(nextAccountType: AccountType) {
    setAccountType(nextAccountType);
    setRequestError('');
    clearFieldError(nextAccountType === 'new' ? 'existingPassword' : 'password');
  }

  function validate() {
    const errors: Record<string, string> = {};

    if (preview?.email_required) {
      if (!email.trim()) errors.email = 'Email diperlukan untuk membuat akun.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Format email tidak valid.';
    }

    if (accountType === 'new') {
      if (!password) errors.password = 'Kata sandi wajib diisi.';
      else if (password.length < 8) errors.password = 'Kata sandi minimal terdiri dari 8 karakter.';
    } else if (!existingPassword) {
      errors.existingPassword = 'Masukkan kata sandi akun yang sudah ada.';
    }

    if (!agree) errors.agree = 'Anda perlu menyetujui kebijakan untuk melanjutkan.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setRequestError('');

    try {
      const result = await apiFetch<{ requires_contact_verification: boolean }>('/api/tenant-invitations/activate', {
        method: 'POST',
        propertyScoped: false,
        body: JSON.stringify({
          token,
          email: email.trim(),
          ...(accountType === 'new' ? { password } : { existing_password: existingPassword }),
          policy_version: 'tenant-activation-v1',
          policy_accepted: agree,
        }),
      });
      setAwaitingVerification(result.requires_contact_verification);
      setSuccess(
        result.requires_contact_verification
          ? 'Akun dibuat. Buka tautan verifikasi dari email; halaman ini akan otomatis melanjutkan ke login setelah verifikasi selesai.'
          : 'Profil tenant berhasil diaktifkan. Anda dapat masuk menggunakan akun yang ada.',
      );
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Aktivasi gagal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-brand-teal">
          <LockKeyhole className="h-6 w-6" />
        </div>
        <p className="mt-5 text-sm font-semibold text-brand-teal">Lapor Kos</p>
        <h1 className="mt-1 text-2xl font-bold text-brand-navy">Aktivasi undangan penghuni</h1>
        <p className="mt-2 text-sm text-slate-500">Aktifkan profil penghuni dan hubungkan dengan akun Anda.</p>

        {loading && token && <p className="mt-6 text-slate-500">Memeriksa undangan...</p>}
        {displayedRequestError && (
          <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <CircleAlert className="h-5 w-5 shrink-0" />
            {displayedRequestError}
          </div>
        )}
        {success && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
            <CheckCircle2 className="h-7 w-7" />
            <p className="mt-2 font-bold">Aktivasi berhasil</p>
            <p className="mt-1 text-sm">{success}</p>
            {awaitingVerification ? (
              <p className="mt-4 rounded-xl bg-white/70 p-3 text-sm font-semibold">Menunggu verifikasi email secara otomatis...</p>
            ) : (
              <Link href="/login" className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white">
                Masuk ke aplikasi
              </Link>
            )}
          </div>
        )}
        {preview && !success && (
          <form noValidate onSubmit={submit} className="mt-6 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">{preview.full_name}</p>
              {preview.email && <p>{preview.email}</p>}
              <p className="mt-1 text-xs text-slate-500">Berlaku sampai {new Date(preview.expires_at).toLocaleString('id-ID')}.</p>
            </div>

            {preview.email_required && (
              <label className="block text-sm font-semibold text-slate-700">
                Alamat email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    clearFieldError('email');
                  }}
                  placeholder="nama@email.com"
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-teal/20 ${formErrors.email ? 'border-red-400' : 'border-slate-300'}`}
                />
                <FieldError message={formErrors.email} />
              </label>
            )}

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700">Pilih akun untuk dihubungkan</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-3 text-sm ${accountType === 'new' ? 'border-brand-teal bg-teal-50 text-brand-navy' : 'border-slate-200 text-slate-700'}`}>
                  <input
                    type="radio"
                    name="account-type"
                    value="new"
                    checked={accountType === 'new'}
                    onChange={() => selectAccountType('new')}
                    className="mr-2"
                  />
                  <span className="font-semibold">Buat akun baru</span>
                  <span className="mt-1 block text-xs text-slate-500">Buat kata sandi untuk akun Anda.</span>
                </label>
                <label className={`cursor-pointer rounded-xl border p-3 text-sm ${accountType === 'existing' ? 'border-brand-teal bg-teal-50 text-brand-navy' : 'border-slate-200 text-slate-700'}`}>
                  <input
                    type="radio"
                    name="account-type"
                    value="existing"
                    checked={accountType === 'existing'}
                    onChange={() => selectAccountType('existing')}
                    className="mr-2"
                  />
                  <span className="font-semibold">Saya sudah punya akun</span>
                  <span className="mt-1 block text-xs text-slate-500">Gunakan kata sandi akun yang sudah ada.</span>
                </label>
              </div>
            </fieldset>

            {accountType === 'new' ? (
              <label className="block text-sm font-semibold text-slate-700">
                Kata sandi akun baru
                <input
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError('password');
                  }}
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-teal/20 ${formErrors.password ? 'border-red-400' : 'border-slate-300'}`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">Minimal 8 karakter.</span>
                <FieldError message={formErrors.password} />
              </label>
            ) : (
              <label className="block text-sm font-semibold text-slate-700">
                Kata sandi akun yang sudah ada
                <input
                  type="password"
                  value={existingPassword}
                  onChange={(event) => {
                    setExistingPassword(event.target.value);
                    clearFieldError('existingPassword');
                  }}
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand-teal/20 ${formErrors.existingPassword ? 'border-red-400' : 'border-slate-300'}`}
                />
                <span className="mt-1 block text-xs font-normal text-slate-500">Kata sandi baru tidak diperlukan.</span>
                <FieldError message={formErrors.existingPassword} />
              </label>
            )}

            <label className={`flex gap-2 rounded-xl border p-3 text-sm text-slate-700 ${formErrors.agree ? 'border-red-400' : 'border-slate-200'}`}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(event) => {
                  setAgree(event.target.checked);
                  clearFieldError('agree');
                }}
                className="mt-0.5"
              />
              <span>
                Saya menyetujui kebijakan dan peraturan kos yang berlaku.
                <FieldError message={formErrors.agree} />
              </span>
            </label>
            <button disabled={submitting} className="w-full rounded-xl bg-brand-teal px-4 py-3 font-bold text-white shadow-lg shadow-teal-500/20 disabled:opacity-60">
              {submitting ? 'Mengaktifkan...' : 'Aktifkan akun'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function ActivateInvitationPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center bg-slate-50 text-slate-500">Menyiapkan aktivasi undangan...</main>}>
      <ActivateInvitationContent />
    </Suspense>
  );
}
