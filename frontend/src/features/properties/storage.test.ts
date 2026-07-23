import { beforeEach, describe, expect, it } from 'vitest';
import {
  ACTIVE_PROPERTY_KEY,
  clearStoredActivePropertyId,
  getStoredActivePropertyId,
  setStoredActivePropertyId,
} from './storage';

describe('active property storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('stores and reads the active property id', () => {
    setStoredActivePropertyId('property-a');
    expect(getStoredActivePropertyId()).toBe('property-a');
    expect(window.localStorage.getItem(ACTIVE_PROPERTY_KEY)).toBe('property-a');
  });

  it('clears the active property id', () => {
    setStoredActivePropertyId('property-a');
    clearStoredActivePropertyId();
    expect(getStoredActivePropertyId()).toBeNull();
  });
});

