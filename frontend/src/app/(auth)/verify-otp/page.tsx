'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, ArrowRight, Home, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import AuthCarousel from '@/components/AuthCarousel';

const verifyOtpSchema = z.object({
  otp: z.string().length(6, 'Kode OTP harus 6 digit'),
});

type VerifyOtpForm = z.infer<typeof verifyOtpSchema>;

export default function VerifyOtpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('reset_email');
    if (!storedEmail) {
      router.push('/forgot-password');
    } else {
      setEmail(storedEmail);
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyOtpForm>({
    resolver: zodResolver(verifyOtpSchema),
  });

  const onSubmit = async (data: VerifyOtpForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp: data.otp }),
      });
      // Store OTP in sessionStorage for the final step
      sessionStorage.setItem('reset_otp', data.otp);
      router.push('/reset-password');
    } catch (err: any) {
      setError(err.message || 'Kode OTP salah atau sudah kadaluarsa.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) return null;

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-cream overflow-hidden">
      {/* LEFT PANEL */}
      <section className="hidden md:flex md:w-[52%] bg-navy relative p-12 flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal/20 blur-[120px] rounded-full animate-float" />
        <div className="absolute top-12 left-12 z-20 flex items-center gap-4 animate-fade-up">
           <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center shadow-lg shadow-teal/20">
             <Home className="text-white w-6 h-6" />
           </div>
           <span className="font-serif text-2xl text-white">Lapor <span className="italic text-teal-light">Kos</span></span>
        </div>
        <AuthCarousel />
      </section>

      {/* RIGHT PANEL */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:px-16 lg:px-24 animate-fade-up">
        <div className="w-full max-w-[440px]">
          <Link href="/forgot-password" title="Ganti Email" className="inline-flex items-center gap-2 text-text-muted hover:text-teal transition-colors mb-8 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Ganti Email</span>
          </Link>

          <header className="mb-10">
            <h2 className="font-serif text-[32px] text-navy mb-3">
              Verifikasi OTP
            </h2>
            <p className="text-sm text-text-mid leading-relaxed">
              Masukkan 6 digit kode yang kami kirimkan ke <span className="font-semibold text-navy">{email}</span>.
            </p>
          </header>

          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-fade-up">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="otp" className="text-sm font-medium text-navy ml-1">
                Kode OTP
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <KeyRound className="w-5 h-5" />
                </div>
                <input
                  {...register('otp')}
                  type="text"
                  id="otp"
                  maxLength={6}
                  placeholder="000000"
                  className={`w-full bg-white border ${errors.otp ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-4 text-center text-xl font-bold tracking-[0.5em] text-navy focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
              </div>
              {errors.otp && <p className="text-xs text-red-500 ml-1">{errors.otp.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Verifikasi OTP</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
          
          <p className="mt-8 text-center text-sm text-text-mid">
            Tidak menerima kode? <button className="text-teal font-semibold hover:underline">Kirim ulang</button>
          </p>
        </div>
      </section>
    </main>
  );
}
