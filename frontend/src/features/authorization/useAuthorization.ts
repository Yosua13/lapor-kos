'use client';

import { useCallback } from 'react';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import { useSession } from '@/features/session/SessionProvider';
import { hasCapability, type Capability } from './permissions';

export const useAuthorization = () => {
  const { user } = useSession();
  const { activeProperty } = useActiveProperty();

  const can = useCallback((capability: Capability): boolean => {
    if (!activeProperty) return false;
    return hasCapability(activeProperty?.role, capability, activeProperty?.permissions);
  }, [activeProperty]);

  return {
    can,
    isTenant: user?.role === 'tenant' && !activeProperty,
    role: activeProperty?.role ?? null,
  };
};
