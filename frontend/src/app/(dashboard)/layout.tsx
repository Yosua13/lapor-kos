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
  MessageSquare,
  FileText,
  Calendar
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

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    if (userData && userData.role === 'tenant') {
      const ownerOnlyPaths = ['/rooms', '/tenants', '/contracts', '/reports'];
      const isOwnerPath = ownerOnlyPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
      if (isOwnerPath) {
        router.push('/');
      }
    }
  }, [pathname, userData, router]);

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const isTenant = userData?.role === 'tenant';

  const navItems: {
    section: string;
    items: {
      name: string;
      href: string;
      icon: any;
      badge?: string;
    }[];
  }[] = isTenant
    ? [
        { section: 'PORTAL PENGHUNI', items: [
          { name: 'Dashboard Saya', href: '/', icon: LayoutDashboard },
          { name: 'Tagihan & Bayar', href: '/payments', icon: CreditCard },
        ]},
        { section: 'LAINNYA', items: [
          { name: 'Komplain Fasilitas', href: '/complaints', icon: MessageSquare },
          { name: 'Pengaturan Akun', href: '/settings', icon: Settings },
        ]}
      ]
    : [
        { section: 'MENU UTAMA', items: [
          { name: 'Dashboard', href: '/', icon: LayoutDashboard },
          { name: 'Manajemen Kamar', href: '/rooms', icon: DoorOpen },
          { name: 'Penghuni & Kontrak', href: '/tenants', icon: Users },
          { name: 'Manajemen Kontrak', href: '/contracts', icon: FileText },
        ]},
        { section: 'KEUANGAN', items: [
          { name: 'Pembayaran', href: '/payments', icon: CreditCard },
          { name: 'Laporan', href: '/reports', icon: Home },
        ]},
        { section: 'LAINNYA', items: [
          { name: 'Kalender', href: '/calendar', icon: Calendar },
          { name: 'Komplain', href: '/complaints', icon: MessageSquare },
          { name: 'Pengaturan', href: '/settings', icon: Settings },
        ]}
      ];

  return (
    <div className="h-screen w-full bg-brand-cream flex relative overflow-hidden">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap');
        
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-teal/5 blur-[120px] rounded-full -mr-48 -mt-48" />
      <div className="noise-bg" />

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0F172A] dark:bg-[#070C1E] text-white-fixed h-full z-40 flex-shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center shadow-lg shadow-brand-teal/20">
            <Home className="text-white-fixed w-5 h-5" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-white-fixed">Lapor <span className="text-brand-teal italic">Kos</span></span>
        </div>

        <nav className="flex-1 px-3 mt-2 space-y-6">
          {navItems.map((section) => (
            <div key={section.section}>
              <p className="text-[10px] font-bold text-white-fixed/30 tracking-[0.2em] px-3 mb-2">{section.section}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-300 group ${
                        isActive 
                          ? 'bg-brand-teal/10 text-brand-teal sidebar-glow' 
                          : 'text-white-fixed/50 hover:text-white-fixed hover:bg-white-fixed/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-5 h-5 transition-transform duration-500 ${isActive ? 'scale-110' : 'group-hover:translate-x-1'}`} />
                        <span className="text-sm font-semibold">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="bg-red-500 text-white-fixed text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20">
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

        <div className="p-5 border-t border-white-fixed/5">
          <div className="flex items-center gap-3 mb-4 px-3">
             <div className="w-10 h-10 bg-white-fixed/10 rounded-full flex items-center justify-center border border-white-fixed/5">
                <User className="text-brand-teal w-5 h-5" />
             </div>
             <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-white-fixed">{userData?.name || 'Yosua R.'}</p>
                <p className="text-[10px] text-white-fixed/40 uppercase tracking-widest">
                  {userData?.role === 'tenant' ? 'Penghuni Kamar' : 'Property Owner'}
                </p>
             </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-white-fixed/40 hover:text-red-400 transition-colors text-sm font-bold group cursor-pointer"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 h-full overflow-y-auto no-scrollbar scroll-smooth">
        {/* Header */}
        <header className="h-20 bg-white/70 dark:bg-[#070C1E]/80 backdrop-blur-md flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40 border-b border-brand-navy/5 dark:border-white-fixed/5 flex-shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <button 
              className="lg:hidden p-2 text-brand-navy"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <button className="p-2.5 text-brand-navy/40 dark:text-white-fixed/60 hover:text-brand-teal dark:hover:text-brand-teal hover:bg-brand-teal/5 dark:hover:bg-brand-teal/10 rounded-xl transition-all">
                  <Bell className="w-5 h-5" />
                </button>
                <button className="p-2.5 text-brand-navy/40 dark:text-white-fixed/60 hover:text-brand-teal dark:hover:text-brand-teal hover:bg-brand-teal/5 dark:hover:bg-brand-teal/10 rounded-xl transition-all">
                    <Settings className="w-5 h-5" />
                </button>
             </div>
             <div className="w-[1px] h-6 bg-brand-navy/10 mx-2" />
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center text-white-fixed font-bold text-sm shadow-lg shadow-brand-teal/10">
                   {userData?.name ? userData.name.substring(0, 2).toUpperCase() : 'YR'}
                 </div>
                 <div className="hidden sm:block">
                    <p className="text-xs font-bold leading-none mb-1">{userData?.name || 'User'}</p>
                    <p className="text-[10px] text-brand-teal font-bold uppercase tracking-widest">
                       {userData?.role === 'tenant' ? 'Penghuni' : 'Owner'}
                    </p>
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
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="w-72 bg-[#0F172A] dark:bg-[#070C1E] h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Nav Content (simplified) */}
            <div className="p-8 flex items-center justify-between">
               <span className="font-display text-2xl font-bold text-white-fixed">Lapor <span className="text-brand-teal">Kos</span></span>
               <button onClick={() => setIsSidebarOpen(false)} className="text-white-fixed/40"><X className="w-6 h-6" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
