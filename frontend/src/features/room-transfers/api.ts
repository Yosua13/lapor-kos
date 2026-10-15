import { apiFetch } from '@/lib/api';
import type {
  CreateTransferRequest,
  PreviewTransferRequest,
  RoomTransfer,
  TenantRoomHistoryItem,
  TransferCalculation,
} from './types';

// Staff API calls
export const listRoomTransfers = async (
  status?: string,
): Promise<RoomTransfer[]> => {
  const params: Record<string, string> = {};
  if (status) params.status = status;

  return apiFetch<RoomTransfer[]>('/api/room-transfers', {
    params,
    propertyScoped: true,
  });
};

export const getRoomTransfer = async (
  id: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/${id}`, {
    propertyScoped: true,
  });
};

export const previewRoomTransfer = async (
  req: PreviewTransferRequest,
): Promise<TransferCalculation> => {
  return apiFetch<TransferCalculation>('/api/room-transfers/preview', {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
};

export const createRoomTransfer = async (
  req: CreateTransferRequest,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>('/api/room-transfers', {
    method: 'POST',
    body: JSON.stringify(req),
    propertyScoped: true,
  });
};

export const approveRoomTransfer = async (
  id: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/${id}/approve`, {
    method: 'PUT',
    propertyScoped: true,
  });
};

export const rejectRoomTransfer = async (
  id: string,
  reason: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
    propertyScoped: true,
  });
};

export const executeRoomTransfer = async (
  id: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/${id}/execute`, {
    method: 'POST',
    propertyScoped: true,
  });
};

export const cancelRoomTransfer = async (
  id: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/${id}/cancel`, {
    method: 'POST',
    propertyScoped: true,
  });
};

export const getTenantRoomHistory = async (
  tenantId: string,
  startDate?: string,
  endDate?: string,
): Promise<TenantRoomHistoryItem[]> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  return apiFetch<TenantRoomHistoryItem[]>(`/api/tenants/${tenantId}/room-history`, {
    params,
    propertyScoped: true,
  });
};

// Tenant Self-Service API calls
export const listMyRoomTransfers = async (): Promise<RoomTransfer[]> => {
  return apiFetch<RoomTransfer[]>('/api/room-transfers/my');
};

export const previewMyRoomTransfer = async (
  req: PreviewTransferRequest,
): Promise<TransferCalculation> => {
  return apiFetch<TransferCalculation>('/api/room-transfers/my/preview', {
    method: 'POST',
    body: JSON.stringify(req),
  });
};

export const createMyRoomTransfer = async (
  req: CreateTransferRequest,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>('/api/room-transfers/my', {
    method: 'POST',
    body: JSON.stringify(req),
  });
};

export const cancelMyRoomTransfer = async (
  id: string,
): Promise<RoomTransfer> => {
  return apiFetch<RoomTransfer>(`/api/room-transfers/my/${id}/cancel`, {
    method: 'POST',
  });
};

export const getMyRoomHistory = async (
  startDate?: string,
  endDate?: string,
): Promise<TenantRoomHistoryItem[]> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  return apiFetch<TenantRoomHistoryItem[]>('/api/tenants/me/room-history', {
    params,
  });
};
