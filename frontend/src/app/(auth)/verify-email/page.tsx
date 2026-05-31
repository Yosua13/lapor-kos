'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Sedang memverifikasi email Anda...');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan.');
      return;
    }

    const verify = async () => {
      try {
        await apiFetch(`/api/auth/verify-email?token=${token}`, {
          method: 'GET',
        });
        setStatus('success');
        setMessage('Email berhasil diverifikasi! Mengalihkan ke halaman login...');
        setTimeout(() => {
          router.push('/login?verified=success');
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Verifikasi gagal. Token mungkin sudah kadaluarsa.');
      }
    };

    verify();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-10 max-w-[440px] w-full shadow-xl shadow-navy/5">
        <div className="mb-8 flex justify-center">
          {status === 'loading' && <Loader2 className="w-16 h-16 text-teal animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-16 h-16 text-teal" />}
          {status === 'error' && <XCircle className="w-16 h-16 text-red-500" />}
        </div>
        
        <h1 className="font-serif text-3xl text-navy mb-4">
          {status === 'loading' ? 'Verifikasi Email' : status === 'success' ? 'Verifikasi Berhasil' : 'Verifikasi Gagal'}
        </h1>
        
        <p className="text-text-mid leading-relaxed mb-8">
          {message}
        </p>

        {status === 'error' && (
          <button
            onClick={() => router.push('/login')}
            className="w-full bg-teal text-white font-semibold py-3.5 rounded-xl hover:bg-teal-light transition-all"
          >
            Kembali ke Login
          </button>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream flex items-center justify-center"><Loader2 className="w-10 h-10 text-teal animate-spin" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
