import { getToken, removeToken } from './auth';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

/**
 * Returns the correct absolute URL for an image stored either on the backend
 * (old /uploads/... paths) or on Supabase Storage (full https:// URLs).
 */
export const getImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // If it's already an absolute URL (Supabase Storage), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Otherwise it's a legacy local path — prepend the API base URL
  return `${API_URL}${url}`;
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export const apiFetch = async (endpoint: string, options: RequestOptions = {}) => {
  const { params, ...fetchOptions } = options;
  
  let url = `${API_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const token = getToken();
  const headers = new Headers(fetchOptions.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  if (!(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (response.status === 401 || (response.status === 404 && data.error === 'User not found')) {
    removeToken();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
      window.location.href = '/login';
    }
    throw new Error(data.error || 'Sesi telah berakhir. Silakan masuk kembali.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
};
