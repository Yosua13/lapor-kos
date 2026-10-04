import { describe, expect, it } from 'vitest';
import { ownerTransitions } from './types';

describe('contract lifecycle UI transitions', () => {
  it('does not expose tenant acceptance as an owner transition', () => {
    expect(ownerTransitions('pending_tenant')).toEqual(['cancelled']);
  });

  it('exposes only valid active terminal transitions', () => {
    expect(ownerTransitions('active')).toEqual(['ended', 'terminated']);
    expect(ownerTransitions('ended')).toEqual([]);
  });
});
