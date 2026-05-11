'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, Home, AlertCircle, Loader2, User } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import AuthCarousel from '@/components/AuthCarousel';

const registerSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push('/login');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-cream overflow-hidden">
      {/* LEFT PANEL - Decorative Branding */}
      <section className="hidden md:flex md:w-[52%] bg-navy relative p-12 flex-col items-center justify-center overflow-hidden">
        {/* Background Decorative Blur */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-teal/20 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-light/10 blur-[100px] rounded-full" />

        {/* Brand Logo Header (Fixed at top) */}
        <div className="absolute top-12 left-12 z-20 flex items-center gap-4 animate-fade-up">
           <div className="w-12 h-12 bg-teal rounded-xl flex items-center justify-center shadow-lg shadow-teal/20">
             <Home className="text-white w-6 h-6" />
           </div>
           <span className="font-serif text-2xl text-white">Lapor <span className="italic text-teal-light">Kos</span></span>
        </div>

        {/* Carousel Content */}
        <AuthCarousel />

        {/* Footer Brand Info */}
        <div className="absolute bottom-10 left-12 text-[12px] text-text-muted font-light opacity-60">
          © 2026 Lapor Kos. All rights reserved.
        </div>
      </section>

      {/* RIGHT PANEL - Register Form */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 py-12 md:px-16 lg:px-24 animate-fade-up">
        {/* Mobile Header */}
        <div className="md:hidden mb-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-teal rounded-2xl flex items-center justify-center mb-4">
            <Home className="text-white w-6 h-6" />
          </div>
          <h2 className="font-serif text-3xl text-navy">
            Lapor <span className="italic text-teal">Kos</span>
          </h2>
        </div>

        <div className="w-full max-w-[440px]">
          {/* Form Header */}
          <header className="mb-10">
            <span className="block text-[12px] font-semibold text-teal tracking-[0.1em] uppercase mb-3">
              Mulai sekarang
            </span>
            <h2 className="font-serif text-[32px] text-navy mb-3">
              Daftar Akun Baru
            </h2>
            <p className="text-sm text-text-mid">
              Sudah punya akun?{' '}
              <Link href="/login" className="font-semibold text-teal hover:text-teal-light transition-colors">
                Masuk di sini
              </Link>
            </p>
          </header>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 animate-fade-up">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-navy ml-1">
                Nama Lengkap
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <User className="w-5 h-5" />
                </div>
                <input
                  {...register('name')}
                  type="text"
                  id="name"
                  placeholder="Masukkan nama lengkap"
                  className={`w-full bg-white border ${errors.name ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-4 text-navy placeholder:text-gray-300 focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
              </div>
              {errors.name && <p className="text-xs text-red-500 ml-1">{errors.name.message}</p>}
            </div>

            {/* Email Field */}
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

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" title="Password" className="text-sm font-medium text-navy ml-1">
                Password
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  placeholder="Minimal 6 karakter"
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 hover:shadow-teal-light/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Mendaftarkan...</span>
                </>
              ) : (
                <>
                  <span>Daftar Sekarang</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-10 flex items-center gap-4 text-text-muted text-[13px]">
            <div className="flex-1 h-px bg-gray-200" />
            <span>atau daftar dengan</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google Button */}
          <button className="w-full bg-white border border-gray-200 hover:border-gray-300 py-3.5 rounded-xl font-medium text-navy flex items-center justify-center gap-3 transition-all hover:bg-gray-50 active:scale-[0.98]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.642 10.231c0-.704-.063-1.38-.18-2.03H10v3.841h5.405c-.233 1.254-.939 2.315-2.003 3.027v2.516h3.245c1.898-1.748 2.995-4.321 2.995-7.354z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.964-.895 6.621-2.423l-3.245-2.516c-.9.602-2.052.958-3.376.958-2.597 0-4.793-1.754-5.577-4.111H1.185v2.599C2.836 17.766 6.166 20 10 20z" fill="#34A853"/>
              <path d="M4.423 11.908c-.2-.602-.314-1.246-.314-1.908s.114-1.306.314-1.908V5.493H1.185C.428 7.004 0 8.7 0 10.5s.428 3.496 1.185 5.007l3.238-2.599z" fill="#FBBC05"/>
              <path d="M10 3.977c1.468 0 2.786.504 3.823 1.495l2.868-2.868C14.959.941 12.695 0 10 0 6.166 0 2.836 2.234 1.185 5.493l3.238 2.599c.784-2.357 2.98-4.115 5.577-4.115z" fill="#EA4335"/>
            </svg>
            <span>Daftar dengan Google</span>
          </button>
        </div>
      </section>
    </main>
  );
}
