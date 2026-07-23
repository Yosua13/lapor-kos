export const ACTIVE_PROPERTY_KEY = 'lapor-kos:active-property-id';

export const getStoredActivePropertyId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_PROPERTY_KEY);
};

export const setStoredActivePropertyId = (propertyId: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACTIVE_PROPERTY_KEY, propertyId);
};

export const clearStoredActivePropertyId = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACTIVE_PROPERTY_KEY);
};

