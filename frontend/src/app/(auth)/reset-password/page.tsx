'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, ArrowRight, Home, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import AuthCarousel from '@/components/AuthCarousel';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password minimal 6 karakter'),
  confirmPassword: z.string().min(6, 'Password minimal 6 karakter'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Password tidak cocok",
  path: ["confirmPassword"],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [otp, setOtp] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('reset_email');
    const storedOtp = sessionStorage.getItem('reset_otp');
    if (!storedEmail || !storedOtp) {
      router.push('/forgot-password');
    } else {
      setEmail(storedEmail);
      setOtp(storedOtp);
    }
  }, [router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    setIsLoading(true);
    setError(null);

    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          otp, 
          new_password: data.newPassword 
        }),
      });
      // Clear session storage
      sessionStorage.removeItem('reset_email');
      sessionStorage.removeItem('reset_otp');
      router.push('/login?reset=success');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat mengatur ulang password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!email || !otp) return null;

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
          <header className="mb-10">
            <h2 className="font-serif text-[32px] text-navy mb-3">
              Reset Password
            </h2>
            <p className="text-sm text-text-mid leading-relaxed">
              Buat password baru yang kuat untuk akun Anda.
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
              <label htmlFor="newPassword" title="Password Baru" className="text-sm font-medium text-navy ml-1">
                Password Baru
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  {...register('newPassword')}
                  type={showPassword ? 'text' : 'password'}
                  id="newPassword"
                  placeholder="Minimal 6 karakter"
                  className={`w-full bg-white border ${errors.newPassword ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-12 text-navy focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-mid transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.newPassword && <p className="text-xs text-red-500 ml-1">{errors.newPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" title="Konfirmasi Password" className="text-sm font-medium text-navy ml-1">
                Konfirmasi Password Baru
              </label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-teal transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  {...register('confirmPassword')}
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  placeholder="Ulangi password baru"
                  className={`w-full bg-white border ${errors.confirmPassword ? 'border-red-300' : 'border-gray-200'} rounded-xl py-3.5 pl-12 pr-4 text-navy focus:outline-none focus:border-teal focus:ring-4 focus:ring-teal/5 transition-all`}
                />
              </div>
              {errors.confirmPassword && <p className="text-xs text-red-500 ml-1">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal hover:bg-teal-light text-white font-semibold py-4 rounded-xl shadow-lg shadow-teal/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 group"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Memperbarui...</span>
                </>
              ) : (
                <>
                  <span>Simpan Password Baru</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
