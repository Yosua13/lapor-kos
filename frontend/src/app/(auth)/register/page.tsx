'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, Loader2, User, CheckCircle2, X } from 'lucide-react';
import Image from 'next/image';
import { apiFetch } from '@/lib/api';
import AuthCarousel from '@/components/AuthCarousel';

const registerSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
  termsAccepted: z.boolean().refine(val => val === true, 'Anda harus menyetujui Syarat & Ketentuan serta Kebijakan Privasi'),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

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
      setShowPopup(true);
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
           <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg shadow-teal/20">
             <Image src="/images/icon-lapor-kos.png" alt="Lapor Kos" width={48} height={48} />
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
          <div className="w-12 h-12 rounded-2xl overflow-hidden mb-4">
            <Image src="/images/icon-lapor-kos.png" alt="Lapor Kos" width={48} height={48} />
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
                  placeholder="Minimal 8 karakter"
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

            {/* Terms and Privacy Checkbox */}
            <div className="space-y-1 mt-2">
              <div className="flex items-start gap-3">
                <input
                  {...register('termsAccepted')}
                  type="checkbox"
                  id="termsAccepted"
                  className="w-4 h-4 mt-1 border-gray-300 rounded text-teal focus:ring-teal accent-[#0e8a7a] cursor-pointer"
                />
                <label htmlFor="termsAccepted" className="text-xs text-text-mid leading-relaxed cursor-pointer selection:bg-transparent">
                  Saya menyetujui{' '}
                  <Link href="/terms" className="font-semibold text-teal hover:text-teal-light transition-colors hover:underline">
                    Syarat & Ketentuan
                  </Link>{' '}
                  dan{' '}
                  <Link href="/privacy" className="font-semibold text-teal hover:text-teal-light transition-colors hover:underline">
                    Kebijakan Privasi
                  </Link>{' '}
                  Lapor Kos. <span className="text-red-500">*</span>
                </label>
              </div>
              {errors.termsAccepted && <p className="text-xs text-red-500 ml-7">{errors.termsAccepted.message}</p>}
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

          {/* Footer */}
          <p className="mt-10 text-center text-[12px] text-text-muted">
            © 2026 Lapor Kos. Hak Cipta Dilindungi.
          </p>
        </div>
      </section>

      {/* Success Popup */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-[400px] w-full shadow-2xl text-center relative animate-in zoom-in-95 duration-300">
            <button 
              onClick={() => { setShowPopup(false); router.push('/login'); }}
              className="absolute top-4 right-4 text-text-muted hover:text-navy transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-20 h-20 bg-teal/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-teal" />
            </div>
            <h3 className="font-serif text-2xl text-navy mb-4">Cek Email Anda</h3>
            <p className="text-text-mid text-[15px] leading-relaxed mb-8">
              Kami telah mengirimkan tautan verifikasi ke email Anda. Silakan klik tautan tersebut untuk mengaktifkan akun Anda.
            </p>
            <button
              onClick={() => { setShowPopup(false); router.push('/login'); }}
              className="w-full bg-teal text-white font-semibold py-3.5 rounded-xl hover:bg-teal-light transition-all"
            >
              Kembali ke Login
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
