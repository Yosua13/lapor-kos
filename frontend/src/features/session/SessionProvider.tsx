'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { removeToken } from '@/lib/auth';
import type { SessionUser } from './types';

interface SessionContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextUser = await apiFetch<SessionUser>('/api/auth/me', { propertyScoped: false });
      setUser(nextUser);
    } catch (caught) {
      setUser(null);
      setError(caught instanceof Error ? caught.message : 'Gagal memuat sesi pengguna');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Bootstrap the external session API when the provider is mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, isLoading, error, reload, logout }), [user, isLoading, error, reload, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = (): SessionContextValue => {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession harus digunakan di dalam SessionProvider');
  return context;
};
