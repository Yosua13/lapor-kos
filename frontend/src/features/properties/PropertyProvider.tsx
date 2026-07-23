'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/features/session/SessionProvider';
import { listProperties } from './api';
import { clearStoredActivePropertyId, getStoredActivePropertyId, setStoredActivePropertyId } from './storage';
import type { PropertySummary } from './types';

interface PropertyContextValue {
  properties: PropertySummary[];
  activeProperty: PropertySummary | null;
  isLoading: boolean;
  error: string | null;
  scopeVersion: number;
  switchProperty: (propertyId: string, navigateToDashboard?: boolean) => void;
  refreshProperties: () => Promise<PropertySummary[]>;
}

const PropertyContext = createContext<PropertyContextValue | null>(null);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isSessionLoading } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeVersion, setScopeVersion] = useState(0);

  const refreshProperties = useCallback(async (): Promise<PropertySummary[]> => {
    if (!user) {
      setProperties([]);
      setActivePropertyId(null);
      clearStoredActivePropertyId();
      setIsLoading(false);
      return [];
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextProperties = await listProperties();
      setProperties(nextProperties);
      setActivePropertyId((current) => {
        const stored = getStoredActivePropertyId();
        const nextId = [current, stored].find((candidate) => candidate && nextProperties.some((property) => property.id === candidate))
          ?? nextProperties[0]?.id
          ?? null;
        if (nextId) setStoredActivePropertyId(nextId);
        else clearStoredActivePropertyId();
        return nextId;
      });
      return nextProperties;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat daftar properti');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isSessionLoading) return;
    // Synchronize fresh server memberships after session resolution.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProperties();
  }, [isSessionLoading, refreshProperties]);

  const switchProperty = useCallback((propertyId: string, navigateToDashboard = true) => {
    if (!properties.some((property) => property.id === propertyId)) return;
    setStoredActivePropertyId(propertyId);
    setActivePropertyId(propertyId);
    setScopeVersion((version) => version + 1);
    if (navigateToDashboard && pathname !== '/') router.replace('/');
    router.refresh();
  }, [pathname, properties, router]);

  const activeProperty = useMemo(
    () => properties.find((property) => property.id === activePropertyId) ?? null,
    [activePropertyId, properties],
  );

  const value = useMemo<PropertyContextValue>(() => ({
    properties,
    activeProperty,
    isLoading: isSessionLoading || isLoading,
    error,
    scopeVersion,
    switchProperty,
    refreshProperties,
  }), [properties, activeProperty, isSessionLoading, isLoading, error, scopeVersion, switchProperty, refreshProperties]);

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}

export const useActiveProperty = (): PropertyContextValue => {
  const context = useContext(PropertyContext);
  if (!context) throw new Error('useActiveProperty harus digunakan di dalam PropertyProvider');
  return context;
};
