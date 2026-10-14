import { apiFetch } from '@/lib/api';
import type {
  AdjustmentPayload,
  AdjustmentPreview,
  BillingJob,
  BillingPolicy,
  Invoice,
  InvoiceList,
  MeterReadingPayload,
} from './types';

export const listInvoices = (
  tenant: boolean,
  page: number,
  pageSize: number,
  status = '',
  period = '',
) => (
  apiFetch<InvoiceList>(tenant ? '/api/invoices/my' : '/api/invoices', {
    propertyScoped: !tenant,
    params: Object.fromEntries(
      Object.entries({
        page: String(page),
        page_size: String(pageSize),
        status,
        period,
      }).filter(([, value]) => value),
    ),
  })
);

export const getInvoice = (id: string, tenant: boolean) =>
  apiFetch<Invoice>(tenant ? `/api/invoices/${id}/my` : `/api/invoices/${id}`, {
    propertyScoped: !tenant,
  });

export const getBillingPolicy = () =>
  apiFetch<BillingPolicy>('/api/billing/policy');

export const updateBillingPolicy = (policy: Partial<BillingPolicy>) =>
  apiFetch<BillingPolicy>('/api/billing/policy', {
    method: 'PUT',
    body: JSON.stringify(policy),
  });

export const generateInvoices = (period: string) =>
  apiFetch<BillingJob>('/api/invoices/generate', {
    method: 'POST',
    body: JSON.stringify({ period }),
  });

export const listBillingJobs = (limit = 20) =>
  apiFetch<BillingJob[]>(`/api/billing/jobs?limit=${limit}`);

export const previewAdjustment = (id: string, body: AdjustmentPayload) =>
  apiFetch<AdjustmentPreview>(`/api/invoices/${id}/adjustments/preview`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const createAdjustment = (id: string, body: AdjustmentPayload) =>
  apiFetch<Invoice>(`/api/invoices/${id}/adjustments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const recordMeterReading = (body: MeterReadingPayload) =>
  apiFetch<{ id: string }>('/api/billing/meter-readings', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const createFinalSettlement = (contractId: string, body: AdjustmentPayload) =>
  apiFetch<Invoice>(`/api/invoices/final-settlements/${contractId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
