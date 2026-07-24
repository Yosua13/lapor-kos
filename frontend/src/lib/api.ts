import { getStoredActivePropertyId } from '@/features/properties/storage';
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

export interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  propertyScoped?: boolean;
}

const isUnscopedEndpoint = (endpoint: string): boolean => (
  endpoint.startsWith('/api/auth/') || endpoint === '/api/properties' || endpoint.startsWith('/api/properties/')
);

const buildUrl = (endpoint: string, params?: Record<string, string>): string => {
  const url = new URL(endpoint, `${API_URL.replace(/\/$/, '')}/`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  return url.toString();
};

const buildHeaders = (endpoint: string, options: RequestOptions): Headers => {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const shouldScope = options.propertyScoped ?? !isUnscopedEndpoint(endpoint);
  const propertyId = shouldScope ? getStoredActivePropertyId() : null;
  if (propertyId && !headers.has('X-Property-ID')) {
    headers.set('X-Property-ID', propertyId);
  }

  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
};

type ErrorPayload = { error?: string; message?: string };

// React Strict Mode intentionally re-runs effects in development. Multiple
// components can also ask for the same resource while the first request is
// still pending. Share only in-flight GET requests: this removes duplicate
// network hits without keeping stale data after a mutation or navigation.
const inFlightGetRequests = new Map<string, Promise<unknown>>();

const parseError = async (response: Response): Promise<ErrorPayload> => {
  try {
    const data = await response.clone().json();
    return typeof data === 'object' && data ? data as ErrorPayload : {};
  } catch {
    try {
      const message = await response.text();
      return message ? { message } : {};
    } catch {
      return {};
    }
  }
};

const request = async (endpoint: string, options: RequestOptions = {}): Promise<Response> => {
  const { params } = options;
  const fetchOptions: RequestInit = { ...options };
  delete (fetchOptions as RequestOptions).params;
  delete (fetchOptions as RequestOptions).propertyScoped;
  const response = await fetch(buildUrl(endpoint, params), {
    ...fetchOptions,
    headers: buildHeaders(endpoint, options),
  });

  if (!response.ok) {
    const data = await parseError(response);
    const message = data.error || data.message || `Permintaan gagal (${response.status})`;

    if (response.status === 401 || (response.status === 404 && data.error === 'User not found')) {
      removeToken();
      if (
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register'
      ) {
        window.location.assign('/login');
      }
    }

    throw new Error(message);
  }

  return response;
};

const readApiResponse = async <T>(endpoint: string, options: RequestOptions): Promise<T> => {
  const response = await request(endpoint, options);

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return await response.text() as T;
  }

  return await response.json() as T;
};

const getRequestKey = (endpoint: string, options: RequestOptions): string => {
  const headers = buildHeaders(endpoint, options);
  return [
    buildUrl(endpoint, options.params),
    headers.get('Authorization') ?? '',
    headers.get('X-Property-ID') ?? '',
    headers.get('Accept') ?? '',
  ].join('|');
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiFetch = <T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> => {
  const method = (options.method ?? 'GET').toUpperCase();
  if (method !== 'GET') return readApiResponse<T>(endpoint, options);

  const requestKey = getRequestKey(endpoint, options);
  const existing = inFlightGetRequests.get(requestKey) as Promise<T> | undefined;
  if (existing) return existing;

  const pending = readApiResponse<T>(endpoint, options);
  inFlightGetRequests.set(requestKey, pending);
  const clear = () => {
    if (inFlightGetRequests.get(requestKey) === pending) {
      inFlightGetRequests.delete(requestKey);
    }
  };
  void pending.then(clear, clear);
  return pending;
};

export const apiBlob = async (endpoint: string, options: RequestOptions = {}): Promise<Blob> => {
  const response = await request(endpoint, options);
  return response.blob();
};
