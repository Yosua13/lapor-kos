'use client';

import type { ReactNode } from 'react';
import { useAuthorization } from './useAuthorization';
import type { Capability } from './permissions';

export function Can({ capability, children, fallback = null }: {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuthorization();
  return can(capability) ? children : fallback;
}

