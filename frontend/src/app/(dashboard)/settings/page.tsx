'use client';

import { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Sun, 
  Moon, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Key,
  Shield,
  Palette,
  Edit2,
  X
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<'profile' | 'security' | 'appearance'>('profile');
  
  // Profile state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [initialProfileData, setInitialProfileData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Security state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Appearance state
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Load user data and theme on mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await apiFetch('/api/auth/me');
        const data = {
          name: user.name || '',
          email: user.email || '',
          phone: user.phone || ''
        };
        setProfileData(data);
        setInitialProfileData(data);
      } catch (err) {
        console.error('Gagal mengambil data profil:', err);
      }
    };
    fetchUser();

    // Check theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme as 'light' | 'dark');
  }, []);

  // Handle profile update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileMessage(null);

    if (!profileData.name.trim()) {
      setProfileMessage({ type: 'error', text: 'Nama lengkap tidak boleh kosong' });
      setIsSavingProfile(false);
      return;
    }

    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone
        })
      });
      setProfileMessage({ type: 'success', text: 'Informasi profil berhasil disimpan!' });
      setInitialProfileData({
        name: profileData.name,
        email: profileData.email,
        phone: profileData.phone
      });
      setIsEditingProfile(false);
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Gagal memperbarui profil' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelProfileEdit = () => {
    setProfileData(initialProfileData);
    setIsEditingProfile(false);
    setProfileMessage(null);
  };

  // Handle password update
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    setPasswordMessage(null);

    if (passwordData.newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Kata sandi baru minimal harus 8 karakter' });
      setIsSavingPassword(false);
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Konfirmasi kata sandi baru tidak cocok' });
      setIsSavingPassword(false);
      return;
    }

    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: passwordData.currentPassword,
          new_password: passwordData.newPassword
        })
      });
      setPasswordMessage({ type: 'success', text: 'Kata sandi Anda berhasil diperbarui!' });
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setIsEditingPassword(false);
      setTimeout(() => setPasswordMessage(null), 4000);
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'Gagal mengganti kata sandi. Pastikan sandi lama benar.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleCancelPasswordEdit = () => {
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setIsEditingPassword(false);
    setPasswordMessage(null);
  };

  // Handle theme switch
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] lg:min-h-[calc(100vh-120px)] w-full space-y-6 animate-slide-up -mt-4 lg:-mt-8 pb-10">
      
      {/* HEADER */}
      <div className="shrink-0 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-display font-extrabold text-brand-navy">Pengaturan</h1>
          <p className="text-[15px] text-gray-500 mt-1">Kelola data profil, keamanan akun, dan tampilan aplikasi Anda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Navigation Sub-Menu */}
        <div className="lg:col-span-4 bg-white border-[1.5px] border-gray-200 rounded-3xl p-5 shadow-sm space-y-2">
          {[
            { id: 'profile', label: 'Profil Saya', desc: 'Nama, Email, dan No HP', icon: User },
            { id: 'security', label: 'Kata Sandi & Keamanan', desc: 'Ubah password login', icon: Shield },
            { id: 'appearance', label: 'Tampilan Aplikasi', desc: 'Mode gelap dan terang', icon: Palette }
          ].map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-300 text-left border ${
                  isActive 
                    ? 'bg-brand-navy/5 border-brand-navy/10 text-brand-navy font-bold' 
                    : 'border-transparent text-gray-500 hover:bg-gray-50 hover:text-brand-navy'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-brand-navy text-white' : 'bg-gray-100 text-gray-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="text-[11px] text-gray-400 font-medium mt-0.5">{item.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Settings Form Panel */}
        <div className="lg:col-span-8">
          
          {/* PROFILE FORM */}
          {activeSection === 'profile' && (
            <div className="bg-white border-[1.5px] border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Informasi Profil</h3>
                <p className="text-xs text-gray-400 mt-1">Perbarui data profil Anda yang digunakan pada sistem</p>
              </div>

              {profileMessage && (
                <div className={`p-4 rounded-2xl border flex gap-3 items-center text-xs font-bold ${
                  profileMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {profileMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                  <span>{profileMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Nama Lengkap</label>
                    <input 
                      type="text"
                      required
                      disabled={!isEditingProfile}
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      placeholder="Masukkan nama lengkap Anda"
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Alamat Email</label>
                    <input 
                      type="email"
                      required
                      disabled={!isEditingProfile}
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      placeholder="contoh@domain.com"
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Nomor HP / WhatsApp</label>
                  <input 
                    type="text"
                    disabled={!isEditingProfile}
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="Contoh: 08123456789"
                    className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                  {!isEditingProfile ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(true)}
                      className="px-6 py-3 bg-[#0e8a7a] hover:bg-[#0c7567] text-white dark:text-slate-950 font-bold rounded-2xl shadow-lg shadow-brand-teal/10 hover:shadow-brand-teal/20 transition-all flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Ubah Profil</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelProfileEdit}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl transition-all flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Batal</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="px-6 py-3 bg-brand-navy hover:bg-brand-navy-light dark:bg-brand-teal dark:hover:bg-brand-teal-light text-white dark:text-slate-950 font-bold rounded-2xl shadow-lg shadow-brand-navy/10 hover:shadow-brand-navy/20 dark:shadow-brand-teal/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingProfile ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* SECURITY FORM */}
          {activeSection === 'security' && (
            <div className="bg-white border-[1.5px] border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Ubah Kata Sandi</h3>
                <p className="text-xs text-gray-400 mt-1">Demi keamanan akun, pastikan kata sandi Anda kuat dan diperbarui secara berkala</p>
              </div>

              {passwordMessage && (
                <div className={`p-4 rounded-2xl border flex gap-3 items-center text-xs font-bold ${
                  passwordMessage.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  {passwordMessage.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                  )}
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleSavePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Kata Sandi Saat Ini</label>
                  <input 
                    type="password"
                    required
                    disabled={!isEditingPassword}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Masukkan sandi saat ini"
                    className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Kata Sandi Baru</label>
                    <input 
                      type="password"
                      required
                      disabled={!isEditingPassword}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Min. 6 karakter"
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-brand-navy/50 uppercase tracking-wider mb-2">Konfirmasi Kata Sandi Baru</label>
                    <input 
                      type="password"
                      required
                      disabled={!isEditingPassword}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Masukkan ulang kata sandi baru"
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-100 focus:bg-white focus:border-brand-navy rounded-2xl transition-all text-sm outline-none text-brand-navy placeholder:text-slate-400 font-medium disabled:opacity-75 disabled:bg-slate-100/50 dark:disabled:bg-slate-800/40 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                  {!isEditingPassword ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingPassword(true)}
                      className="px-6 py-3 bg-brand-teal hover:bg-brand-teal-light text-white dark:text-slate-950 font-bold rounded-2xl shadow-lg shadow-brand-teal/10 hover:shadow-brand-teal/20 transition-all flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Ubah Kata Sandi</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleCancelPasswordEdit}
                        className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold rounded-2xl transition-all flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                        <span>Batal</span>
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingPassword}
                        className="px-6 py-3 bg-brand-navy hover:bg-brand-navy-light dark:bg-brand-teal dark:hover:bg-brand-teal-light text-white dark:text-slate-950 font-bold rounded-2xl shadow-lg shadow-brand-navy/10 hover:shadow-brand-navy/20 dark:shadow-brand-teal/10 transition-all flex items-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
                      >
                        <Key className="w-4 h-4" />
                        <span>{isSavingPassword ? 'Memperbarui...' : 'Perbarui Kata Sandi'}</span>
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* APPEARANCE CONFIG */}
          {activeSection === 'appearance' && (
            <div className="bg-white border-[1.5px] border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-xl font-display font-bold text-brand-navy">Tampilan Aplikasi</h3>
                <p className="text-xs text-gray-400 mt-1">Pilih tema aplikasi yang paling nyaman untuk mata Anda</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Light Mode Selector Card */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all relative group text-left ${
                    theme === 'light' 
                      ? 'border-brand-teal bg-brand-teal/5 text-brand-navy font-bold' 
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${theme === 'light' ? 'bg-brand-teal text-white shadow-lg' : 'bg-gray-100 text-gray-400 group-hover:scale-105'}`}>
                    <Sun className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">Mode Terang (Light Mode)</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-1">Cocok digunakan di tempat terang</p>
                  </div>
                </button>

                {/* Dark Mode Selector Card */}
                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex flex-col items-center gap-4 p-6 rounded-2xl border-2 transition-all relative group text-left ${
                    theme === 'dark' 
                      ? 'border-brand-teal bg-brand-teal/5 text-brand-navy font-bold' 
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${theme === 'dark' ? 'bg-brand-teal text-white shadow-lg' : 'bg-gray-100 text-gray-400 group-hover:scale-105'}`}>
                    <Moon className="w-7 h-7" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold">Mode Gelap (Dark Mode)</p>
                    <p className="text-[11px] text-gray-400 font-medium mt-1">Lebih nyaman di mata saat minim cahaya</p>
                  </div>
                </button>

              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
