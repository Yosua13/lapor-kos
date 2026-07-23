import { DashboardShell } from '@/components/layout/DashboardShell';
import { PropertyProvider } from '@/features/properties/PropertyProvider';
import { SessionProvider } from '@/features/session/SessionProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <PropertyProvider>
        <DashboardShell>{children}</DashboardShell>
      </PropertyProvider>
    </SessionProvider>
  );
}
