'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useSession } from '@/features/session/SessionProvider';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { PropertyAccessEmptyState } from '@/features/properties/components/PropertyAccessEmptyState';
import { getNavigation, getRequiredCapability, isStaffOnlyPath } from './navigation';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isSessionLoading, error: sessionError, reload, logout } = useSession();
  const { activeProperty, properties, isLoading: isPropertyLoading, error: propertyError, scopeVersion, refreshProperties } = useActiveProperty();
  const { can, isTenant, role } = useAuthorization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const theme = window.localStorage.getItem('theme');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, []);

  useEffect(() => {
    if (!user || isSessionLoading || isPropertyLoading) return;
    if (isTenant && isStaffOnlyPath(pathname)) {
      router.replace('/');
      return;
    }
    const required = getRequiredCapability(pathname);
    if (!isTenant && activeProperty && required && !can(required)) router.replace('/');
  }, [activeProperty, can, isPropertyLoading, isSessionLoading, isTenant, pathname, router, user]);

  const navigation = useMemo(() => getNavigation(isTenant, can), [can, isTenant]);

  if (isSessionLoading || isPropertyLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-brand-cream"><Loader2 className="h-10 w-10 animate-spin text-brand-teal" /></div>;
  }

  if (!user || sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream p-6">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-bold text-brand-navy">Sesi tidak dapat dimuat</h1>
          <p className="mt-2 text-sm text-brand-navy/50">{sessionError}</p>
          <button type="button" onClick={() => void reload()} className="mt-5 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white">Coba lagi</button>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.replace('/login');
  };

  const showEmptyProperty = !isTenant && properties.length === 0 && pathname !== '/properties';

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-brand-cream">
      <div className="noise-bg" />
      <Sidebar navigation={navigation} pathname={pathname} user={user} membershipRole={role} isTenant={isTenant} onLogout={handleLogout} />

      <div className="no-scrollbar relative z-10 flex h-full min-w-0 flex-1 flex-col overflow-y-auto scroll-smooth">
        <Topbar user={user} isTenant={isTenant} onOpenMenu={() => setIsSidebarOpen(true)} />
        <main key={`${activeProperty?.id ?? 'tenant'}:${scopeVersion}`} className="p-6 lg:p-10">
          {propertyError && !isTenant ? (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{propertyError}</span>
              <button type="button" onClick={() => void refreshProperties()} className="font-bold">Coba lagi</button>
            </div>
          ) : null}
          {showEmptyProperty ? <PropertyAccessEmptyState /> : children}
        </main>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setIsSidebarOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>
            <Sidebar
              mobile
              navigation={navigation}
              pathname={pathname}
              user={user}
              membershipRole={role}
              isTenant={isTenant}
              onClose={() => setIsSidebarOpen(false)}
              onLogout={handleLogout}
            />
          </div>
        </div>
      )}
    </div>
  );
}
