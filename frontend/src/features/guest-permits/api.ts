import { apiFetch } from '@/lib/api';
import type {
  CreateVisitorPermitInput,
  ListVisitorPermitsParams,
  VisitorPassVerification,
  VisitorPermit,
  VisitorPermitEvent,
  VisitorPermitSummary,
} from './types';

interface ListPermitsResponse {
  data: VisitorPermit[];
  total: number;
  page: number;
  per_page: number;
}

interface SinglePermitResponse {
  data: VisitorPermit;
  events?: VisitorPermitEvent[];
}

// --- Management (Staff / Owner) APIs ---

export const listVisitorPermits = async (
  params?: ListVisitorPermitsParams,
): Promise<ListPermitsResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.from_date) queryParams.from_date = params.from_date;
  if (params?.to_date) queryParams.to_date = params.to_date;
  if (params?.is_overnight !== undefined) queryParams.is_overnight = String(params.is_overnight);
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.per_page) queryParams.per_page = String(params.per_page);

  return apiFetch<ListPermitsResponse>('/api/visitor-permits', {
    params: queryParams,
    propertyScoped: true,
  });
};

export const getVisitorPermit = async (id: string): Promise<SinglePermitResponse> => {
  return apiFetch<SinglePermitResponse>(`/api/visitor-permits/${id}`, {
    propertyScoped: true,
  });
};

export const getVisitorSummary = async (): Promise<VisitorPermitSummary> => {
  const res = await apiFetch<{ data: VisitorPermitSummary }>('/api/visitor-permits/summary', {
    propertyScoped: true,
  });
  return res.data;
};

export const approveVisitorPermit = async (id: string, reason?: string): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || '' }),
    propertyScoped: true,
  });
  return res.data;
};

export const rejectVisitorPermit = async (id: string, reason: string): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    propertyScoped: true,
  });
  return res.data;
};

export const requestChangeVisitorPermit = async (
  id: string,
  reason: string,
): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/${id}/request-change`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    propertyScoped: true,
  });
  return res.data;
};

export const checkInVisitor = async (id: string): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/${id}/check-in`, {
    method: 'POST',
    propertyScoped: true,
  });
  return res.data;
};

export const checkOutVisitor = async (id: string): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/${id}/check-out`, {
    method: 'POST',
    propertyScoped: true,
  });
  return res.data;
};

export const applyVisitorRetention = async (
  olderThanDays = 30,
): Promise<{ message: string; anonymized_count: number }> => {
  return apiFetch<{ message: string; anonymized_count: number }>(
    '/api/visitor-permits/retention/apply',
    {
      method: 'POST',
      body: JSON.stringify({ older_than_days: olderThanDays }),
      propertyScoped: true,
    },
  );
};

// --- Tenant APIs ---

export const tenantListVisitorPermits = async (
  params?: ListVisitorPermitsParams,
): Promise<ListPermitsResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.from_date) queryParams.from_date = params.from_date;
  if (params?.to_date) queryParams.to_date = params.to_date;
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.per_page) queryParams.per_page = String(params.per_page);

  return apiFetch<ListPermitsResponse>('/api/visitor-permits/my', {
    params: queryParams,
  });
};

export const tenantCreateVisitorPermit = async (
  req: CreateVisitorPermitInput,
): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>('/api/visitor-permits/my', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.data;
};

export const tenantGetVisitorPermit = async (id: string): Promise<SinglePermitResponse> => {
  return apiFetch<SinglePermitResponse>(`/api/visitor-permits/my/${id}`);
};

export const tenantCancelVisitorPermit = async (
  id: string,
  reason?: string,
): Promise<VisitorPermit> => {
  const res = await apiFetch<{ data: VisitorPermit }>(`/api/visitor-permits/my/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Dibatalkan oleh penyewa' }),
  });
  return res.data;
};

// --- Public Verification API ---

export const verifyVisitorPass = async (token: string): Promise<VisitorPassVerification> => {
  const res = await apiFetch<{ data: VisitorPassVerification }>(`/api/visitor-passes/${token}`);
  return res.data;
};
