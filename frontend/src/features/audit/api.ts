import { apiFetch } from '@/lib/api';
import type {
  FinancialAuditFilter,
  FinancialAuditListResult,
  RevokeSessionPayload,
  SecurityChecklist,
  SystemHealthStatus,
} from './types';

export const listFinancialAudits = async (
  propertyId: string,
  filter?: FinancialAuditFilter,
): Promise<FinancialAuditListResult> => {
  const params: Record<string, string> = {};
  if (filter?.entity_type) params.entity_type = filter.entity_type;
  if (filter?.action) params.action = filter.action;
  if (filter?.correlation_id) params.correlation_id = filter.correlation_id;
  if (filter?.actor_id) params.actor_id = filter.actor_id;
  if (filter?.start_date) params.start_date = filter.start_date;
  if (filter?.end_date) params.end_date = filter.end_date;
  if (filter?.page) params.page = String(filter.page);
  if (filter?.page_size) params.page_size = String(filter.page_size);

  return apiFetch<FinancialAuditListResult>(
    `/api/v1/properties/${propertyId}/audit/financial`,
    {
      params,
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const getSystemHealth = async (): Promise<SystemHealthStatus> => {
  return apiFetch<SystemHealthStatus>('/api/ready');
};

export const getSecurityChecklist = async (propertyId?: string): Promise<SecurityChecklist> => {
  const headers: Record<string, string> = {};
  if (propertyId) headers['X-Property-ID'] = propertyId;
  return apiFetch<SecurityChecklist>('/api/security/checklist', { headers });
};

export const revokeUserSession = async (
  payload: RevokeSessionPayload,
): Promise<{ message: string; user_id: string }> => {
  return apiFetch<{ message: string; user_id: string }>(
    '/api/security/sessions/revoke',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
};

export const revokeMySessions = async (): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>('/api/auth/revoke-sessions', {
    method: 'POST',
  });
};
