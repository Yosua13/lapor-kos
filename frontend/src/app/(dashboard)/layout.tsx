'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  UserGroupIcon, // I'll use Lucide icons instead
  Settings, 
  LogOut, 
  Menu, 
  X,
  LayoutDashboard,
  DoorOpen,
  Users,
  Bell,
  Search,
  User
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
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Manajemen Kamar', href: '/rooms', icon: DoorOpen },
    { name: 'Data Penghuni', href: '/tenants', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-navy text-white h-screen sticky top-0 border-r border-navy-light/10">
        <div className="p-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-teal rounded-xl flex items-center justify-center">
            <Home className="text-white w-5 h-5" />
          </div>
          <span className="font-serif text-xl">Lapor <span className="italic text-teal-light">Kos</span></span>
        </div>

        <nav className="flex-1 px-4 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3.5 mb-2 rounded-xl transition-all group ${
                  isActive 
                    ? 'bg-teal text-white shadow-lg shadow-teal/20' 
                    : 'text-text-muted hover:bg-navy-light/30 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-text-muted group-hover:text-teal-light'}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6 border-t border-navy-light/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-text-muted hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-navy"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-3 bg-cream/50 px-4 py-2 rounded-xl border border-gray-100 w-80">
              <Search className="w-4 h-4 text-text-muted" />
              <input 
                type="text" 
                placeholder="Cari sesuatu..." 
                className="bg-transparent border-none text-sm focus:outline-none w-full text-navy"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-text-muted hover:text-teal transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            
            <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-navy leading-none mb-1">
                  {userData?.name || 'Loading...'}
                </p>
                <p className="text-[11px] text-teal font-medium uppercase tracking-wider">
                  {userData?.role || 'Owner'}
                </p>
              </div>
              <div className="w-10 h-10 bg-teal/10 rounded-full flex items-center justify-center border border-teal/20 overflow-hidden">
                <User className="text-teal w-5 h-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-10">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-navy/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="w-72 bg-navy h-full animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-teal rounded-lg flex items-center justify-center">
                  <Home className="text-white w-4 h-4" />
                </div>
                <span className="font-serif text-lg text-white">Lapor <span className="italic text-teal-light">Kos</span></span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <nav className="px-4 mt-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 mb-2 rounded-xl transition-all ${
                      isActive ? 'bg-teal text-white shadow-lg shadow-teal/20' : 'text-text-muted'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
