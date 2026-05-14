'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  LogOut, 
  Menu, 
  X,
  LayoutDashboard,
  DoorOpen,
  Users,
  Bell,
  Search,
  User,
  Settings,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { removeToken } from '@/lib/auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await apiFetch('/api/auth/me');
        setUserData(user);
      } catch (err) {
        router.push('/login');
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const navItems = [
    { section: 'MENU UTAMA', items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Manajemen Kamar', href: '/rooms', icon: DoorOpen },
      { name: 'Data Penghuni', href: '/tenants', icon: Users },
    ]},
    { section: 'KEUANGAN', items: [
      { name: 'Pembayaran', href: '/payments', icon: CreditCard, badge: '3' },
      { name: 'Laporan', href: '/reports', icon: Home },
    ]},
    { section: 'LAINNYA', items: [
      { name: 'Komplain', href: '/complaints', icon: MessageSquare, badge: '1' },
      { name: 'Pengaturan', href: '/settings', icon: Settings },
    ]}
  ];

  return (
    <div className="min-h-screen bg-brand-cream flex relative overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
      `}</style>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-teal/5 blur-[120px] rounded-full -mr-48 -mt-48" />
      <div className="noise-bg" />

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-brand-navy text-white h-screen sticky top-0 z-40">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center shadow-lg shadow-brand-teal/20">
            <Home className="text-white w-5 h-5" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">Lapor <span className="text-brand-teal italic">Kos</span></span>
        </div>

        <nav className="flex-1 px-4 mt-4 space-y-8">
          {navItems.map((section) => (
            <div key={section.section}>
              <p className="text-[10px] font-bold text-white/30 tracking-[0.2em] px-4 mb-4">{section.section}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 group ${
                        isActive 
                          ? 'bg-brand-teal/10 text-brand-teal sidebar-glow' 
                          : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:translate-x-1'}`} />
                        <span className="text-sm font-semibold">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 mb-6 px-4">
             <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/5">
                <User className="text-brand-teal w-5 h-5" />
             </div>
             <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{userData?.name || 'Yosua R.'}</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Property Owner</p>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-white/40 hover:text-red-400 transition-colors text-sm font-bold group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <header className="h-20 bg-white/70 backdrop-blur-md flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40 border-b border-brand-navy/5">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="lg:hidden p-2 text-brand-navy"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-3 bg-brand-navy/5 px-4 py-2.5 rounded-2xl w-full max-w-md border border-brand-navy/5 focus-within:bg-white focus-within:shadow-xl focus-within:shadow-brand-teal/5 transition-all">
              <Search className="w-4 h-4 text-brand-navy/30" />
              <input 
                type="text" 
                placeholder="Cari kamar, penghuni, atau pembayaran..." 
                className="bg-transparent border-none text-sm focus:outline-none w-full text-brand-navy placeholder:text-brand-navy/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <button className="p-2.5 text-brand-navy/40 hover:text-brand-teal hover:bg-brand-teal/5 rounded-xl transition-all">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 text-brand-navy/40 hover:text-brand-teal hover:bg-brand-teal/5 rounded-xl transition-all">
                   <Settings className="w-5 h-5" />
                </button>
             </div>
             <div className="w-[1px] h-6 bg-brand-navy/10 mx-2" />
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-brand-teal/10">
                  YR
                </div>
                <div className="hidden sm:block">
                   <p className="text-xs font-bold leading-none mb-1">Yosua Reynaldi</p>
                   <p className="text-[10px] text-brand-teal font-bold uppercase tracking-widest">Owner</p>
                </div>
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-10 animate-slide-in bg-transparent">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-brand-navy/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="w-72 bg-brand-navy h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Nav Content (simplified) */}
            <div className="p-8 flex items-center justify-between">
               <span className="font-display text-2xl font-bold text-white">Lapor <span className="text-brand-teal">Kos</span></span>
               <button onClick={() => setIsSidebarOpen(false)} className="text-white/40"><X className="w-6 h-6" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
