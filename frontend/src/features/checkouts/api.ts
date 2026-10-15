import { apiFetch } from '@/lib/api';
import type {
  CheckoutCase,
  CreateCheckoutNoticeRequest,
  ExecuteCheckoutRequest,
  RecordInspectionRequest,
  RoomOverrideRequest,
  SettlementCalculation,
} from './types';

interface ListCheckoutsResponse {
  items: CheckoutCase[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

// --- Management (Staff / Owner) APIs ---

export const listCheckouts = async (
  params?: { status?: string; tenant_id?: string; room_id?: string; page?: number; page_size?: number },
): Promise<ListCheckoutsResponse> => {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.tenant_id) queryParams.tenant_id = params.tenant_id;
  if (params?.room_id) queryParams.room_id = params.room_id;
  if (params?.page) queryParams.page = String(params.page);
  if (params?.page_size) queryParams.page_size = String(params.page_size);

  const res = await apiFetch<{ data: ListCheckoutsResponse }>('/api/checkouts', {
    params: queryParams,
    propertyScoped: true,
  });
  return res.data;
};

export const getCheckout = async (id: string): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>(`/api/checkouts/${id}`, {
    propertyScoped: true,
  });
  return res.data;
};

export const createCheckout = async (
  req: CreateCheckoutNoticeRequest,
): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>('/api/checkouts', {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
  return res.data;
};

export const recordInspections = async (
  id: string,
  req: RecordInspectionRequest,
): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>(`/api/checkouts/${id}/inspections`, {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
  return res.data;
};

export const previewSettlement = async (id: string): Promise<SettlementCalculation> => {
  const res = await apiFetch<{ data: SettlementCalculation }>(`/api/checkouts/${id}/settlement-preview`, {
    propertyScoped: true,
  });
  return res.data;
};

export const approveSettlement = async (
  id: string,
  notes?: string,
): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>(`/api/checkouts/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
    propertyScoped: true,
  });
  return res.data;
};

export const executeCheckout = async (
  id: string,
  req: ExecuteCheckoutRequest,
): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>(`/api/checkouts/${id}/execute`, {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
  return res.data;
};

export const cancelCheckout = async (
  id: string,
  reason: string,
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/checkouts/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    propertyScoped: true,
  });
};

export const overrideRoomStatus = async (
  id: string,
  req: RoomOverrideRequest,
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/checkouts/${id}/room-override`, {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
};

// --- Tenant Self-Service APIs ---

export const tenantListCheckouts = async (): Promise<CheckoutCase[]> => {
  const res = await apiFetch<{ data: CheckoutCase[] }>('/api/checkouts/my');
  return res.data;
};

export const tenantGetCheckout = async (id: string): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>(`/api/checkouts/my/${id}`);
  return res.data;
};

export const tenantCreateNotice = async (
  req: CreateCheckoutNoticeRequest,
): Promise<CheckoutCase> => {
  const res = await apiFetch<{ data: CheckoutCase }>('/api/checkouts/my', {
    method: 'POST',
    body: JSON.stringify(req),
  });
  return res.data;
};
