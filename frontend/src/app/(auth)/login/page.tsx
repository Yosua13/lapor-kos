'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Home, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { setToken } from '@/lib/auth';
import AuthCarousel from '@/components/AuthCarousel';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  remember: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('reset') === 'success') {
      setSuccess('Password berhasil diatur ulang. Silakan masuk dengan password baru Anda.');
    }
    if (searchParams.get('verified') === 'success') {
      setSuccess('Email berhasil diverifikasi. Silakan masuk ke akun Anda.');
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember: false,
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      setToken(result.token, data.remember);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Email atau password salah. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-cream overflow-hidden">
      {/* LEFT PANEL - Decorative Branding */}
      <section className="hidden md:flex md:w-[52%] bg-navy relative p-12 flex-col items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal/20 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-light/10 blur-[100px] rounded-full" />

        <div className="absolute top-12 left-12 z-20 flex items-center gap-4 animate-fade-up">
           <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center shadow-lg shadow-teal/20">
             <Home className="text-white w-6 h-6" />
           </div>
           <span className="font-serif text-2xl text-white">Lapor <span className="italic text-teal-light">Kos</span></span>
        </div>

        <AuthCarousel />

        <div className="absolute bottom-10 left-12 text-[12px] text-text-muted font-light opacity-60">
          © 2026 Lapor Kos. All rights reserved.
        </div>
      </section>

      {/* RIGHT PANEL - Login Form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:px-16 lg:px-24 animate-fade-up">
        <div className="md:hidden mb-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-teal rounded-2xl flex items-center justify-center mb-4">
            <Home className="text-white w-6 h-6" />
          </div>
          <h2 className="font-serif text-3xl text-navy">
            Lapor <span className="italic text-teal">Kos</span>
          </h2>
        </div>

        <div className="w-full max-w-[440px]">
          <header className="mb-10">
            <span className="block text-[12px] font-semibold text-teal tracking-[0.1em] uppercase mb-3">
              Selamat datang
            </span>
            <h2 className="font-serif text-[32px] text-navy mb-3">
              Masuk ke akun Anda
            </h2>
            <p className="text-sm text-text-mid">
              Belum punya akun?{' '}
              <Link href="/register" className="font-semibold text-teal hover:text-teal-light transition-colors">
                Daftar gratis
              </Link>
            </p>
          </header>

          {/* Success Message */}
          {success && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-teal/5 border border-teal/20 rounded-xl text-teal animate-fade-up">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-fade-up">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-navy ml-1">
                Alamat Email
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  placeholder="admin@laporkos.id"
                  className={`w-full bg-white border ${errors.email ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-4 text-navy placeholder:text-gray-300 focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 ml-1">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" title="Password" className="text-sm font-medium text-navy">
                  Password
                </label>
                <Link href="/forgot-password" title="Lupa password?" className="text-xs font-semibold text-teal hover:text-teal-light transition-colors">
                  Lupa password?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Masukkan password"
                  className={`w-full bg-white border ${errors.password ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-12 text-navy placeholder:text-gray-300 focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-mid transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 ml-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center gap-3 px-1">
              <input
                {...register('remember')}
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal accent-teal"
              />
              <label htmlFor="remember" className="text-sm text-text-mid cursor-pointer select-none">
                Ingat saya selama 30 hari
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 hover:shadow-teal-light/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <span>Masuk Sekarang</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-10 text-center text-[12px] text-text-muted leading-relaxed">
            Dengan masuk, Anda menyetujui{' '}
            <Link href="/terms" className="text-teal font-medium hover:underline">Syarat & Ketentuan</Link>
            {' '}dan{' '}
            <Link href="/privacy" className="text-teal font-medium hover:underline">Kebijakan Privasi</Link> kami.
          </p>
        </div>
      </section>
    </main>
  );
}
