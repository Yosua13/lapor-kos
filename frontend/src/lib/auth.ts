import { clearStoredActivePropertyId } from '@/features/properties/storage';

export const TOKEN_KEY = 'auth_token';

export const setToken = (token: string, remember: boolean = true) => {
  if (typeof window !== 'undefined') {
    clearStoredActivePropertyId();
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
    // Set cookie for middleware access
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${remember ? 86400 * 30 : 86400}; SameSite=Strict${secure}`;
  }
};

export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  }
  return null;
};

export const removeToken = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    clearStoredActivePropertyId();
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${TOKEN_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict${secure}`;
  }
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};
