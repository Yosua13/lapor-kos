import { apiFetch, apiBlob } from '@/lib/api';
import type {
  CreateExpensePayload,
  Expense,
  ExpenseFilter,
  FinancialDashboardSummary,
  FinanceExportJob,
  FinancePeriodAdjustment,
  FinancePeriodClosure,
  ReceivablesAgingSummary,
  UpdateExpensePayload,
} from './types';

export const getFinancialDashboard = async (
  propertyId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<FinancialDashboardSummary> => {
  const params: Record<string, string> = {};
  if (periodStart) params.period_start = periodStart;
  if (periodEnd) params.period_end = periodEnd;

  return apiFetch<FinancialDashboardSummary>(
    `/api/v1/properties/${propertyId}/finance/dashboard`,
    {
      params,
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const getReceivablesAging = async (
  propertyId: string,
): Promise<ReceivablesAgingSummary> => {
  return apiFetch<ReceivablesAgingSummary>(
    `/api/v1/properties/${propertyId}/finance/aging`,
    {
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const listExpenses = async (
  propertyId: string,
  filter?: ExpenseFilter,
): Promise<{ data: Expense[]; total: number; page: number; page_size: number }> => {
  const params: Record<string, string> = {};
  if (filter?.category) params.category = filter.category;
  if (filter?.status) params.status = filter.status;
  if (filter?.vendor_id) params.vendor_id = filter.vendor_id;
  if (filter?.start_date) params.start_date = filter.start_date;
  if (filter?.end_date) params.end_date = filter.end_date;
  if (filter?.search) params.search = filter.search;
  if (filter?.page) params.page = String(filter.page);
  if (filter?.page_size) params.page_size = String(filter.page_size);

  return apiFetch<{ data: Expense[]; total: number; page: number; page_size: number }>(
    `/api/v1/properties/${propertyId}/expenses`,
    {
      params,
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const getExpense = async (propertyId: string, id: string): Promise<Expense> => {
  return apiFetch<Expense>(`/api/v1/properties/${propertyId}/expenses/${id}`, {
    headers: { 'X-Property-ID': propertyId },
  });
};

export const createExpense = async (
  propertyId: string,
  payload: CreateExpensePayload,
): Promise<Expense> => {
  return apiFetch<Expense>(`/api/v1/properties/${propertyId}/expenses`, {
    method: 'POST',
    headers: { 'X-Property-ID': propertyId },
    body: JSON.stringify(payload),
  });
};

export const updateExpense = async (
  propertyId: string,
  id: string,
  payload: UpdateExpensePayload,
): Promise<Expense> => {
  return apiFetch<Expense>(`/api/v1/properties/${propertyId}/expenses/${id}`, {
    method: 'PUT',
    headers: { 'X-Property-ID': propertyId },
    body: JSON.stringify(payload),
  });
};

export const approveExpense = async (propertyId: string, id: string): Promise<Expense> => {
  return apiFetch<Expense>(`/api/v1/properties/${propertyId}/expenses/${id}/approve`, {
    method: 'POST',
    headers: { 'X-Property-ID': propertyId },
  });
};

export const payExpense = async (
  propertyId: string,
  id: string,
  paymentMethod?: string,
): Promise<Expense> => {
  return apiFetch<Expense>(`/api/v1/properties/${propertyId}/expenses/${id}/pay`, {
    method: 'POST',
    headers: { 'X-Property-ID': propertyId },
    body: JSON.stringify({ payment_method: paymentMethod || 'bank_transfer' }),
  });
};

export const deleteExpense = async (propertyId: string, id: string): Promise<void> => {
  await apiFetch<void>(`/api/v1/properties/${propertyId}/expenses/${id}`, {
    method: 'DELETE',
    headers: { 'X-Property-ID': propertyId },
  });
};

export const listPeriodClosures = async (
  propertyId: string,
): Promise<FinancePeriodClosure[]> => {
  return apiFetch<FinancePeriodClosure[]>(
    `/api/v1/properties/${propertyId}/finance/period-closures`,
    {
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const getPeriodClosure = async (
  propertyId: string,
  periodKey: string,
): Promise<FinancePeriodClosure> => {
  return apiFetch<FinancePeriodClosure>(
    `/api/v1/properties/${propertyId}/finance/period-closures/${periodKey}`,
    {
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const closePeriod = async (
  propertyId: string,
  payload: { period_key: string; notes?: string },
): Promise<FinancePeriodClosure> => {
  return apiFetch<FinancePeriodClosure>(
    `/api/v1/properties/${propertyId}/finance/period-closures`,
    {
      method: 'POST',
      headers: { 'X-Property-ID': propertyId },
      body: JSON.stringify(payload),
    },
  );
};

export const reopenPeriod = async (
  propertyId: string,
  periodKey: string,
  reason: string,
): Promise<FinancePeriodClosure> => {
  return apiFetch<FinancePeriodClosure>(
    `/api/v1/properties/${propertyId}/finance/period-closures/${periodKey}/reopen`,
    {
      method: 'POST',
      headers: { 'X-Property-ID': propertyId },
      body: JSON.stringify({ reason }),
    },
  );
};

export const listAdjustments = async (
  propertyId: string,
  periodCloseId?: string,
): Promise<FinancePeriodAdjustment[]> => {
  const params: Record<string, string> = {};
  if (periodCloseId) params.period_close_id = periodCloseId;

  return apiFetch<FinancePeriodAdjustment[]>(
    `/api/v1/properties/${propertyId}/finance/adjustments`,
    {
      params,
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const createAdjustment = async (
  propertyId: string,
  payload: {
    period_close_id: string;
    adjustment_type: string;
    amount_minor: number;
    reason: string;
  },
): Promise<FinancePeriodAdjustment> => {
  return apiFetch<FinancePeriodAdjustment>(
    `/api/v1/properties/${propertyId}/finance/adjustments`,
    {
      method: 'POST',
      headers: { 'X-Property-ID': propertyId },
      body: JSON.stringify(payload),
    },
  );
};

export const approveAdjustment = async (
  propertyId: string,
  adjustmentId: string,
  payload: {
    approved: boolean;
    rejection_reason?: string;
    notes?: string;
  },
): Promise<FinancePeriodAdjustment> => {
  return apiFetch<FinancePeriodAdjustment>(
    `/api/v1/properties/${propertyId}/finance/adjustments/${adjustmentId}/approve`,
    {
      method: 'POST',
      headers: { 'X-Property-ID': propertyId },
      body: JSON.stringify(payload),
    },
  );
};

export const createExportJob = async (
  propertyId: string,
  payload: {
    report_type: string;
    period_start: string;
    period_end: string;
    export_format?: string;
  },
): Promise<FinanceExportJob> => {
  return apiFetch<FinanceExportJob>(
    `/api/v1/properties/${propertyId}/finance/exports`,
    {
      method: 'POST',
      headers: { 'X-Property-ID': propertyId },
      body: JSON.stringify(payload),
    },
  );
};

export const listExportJobs = async (
  propertyId: string,
): Promise<FinanceExportJob[]> => {
  return apiFetch<FinanceExportJob[]>(
    `/api/v1/properties/${propertyId}/finance/exports`,
    {
      headers: { 'X-Property-ID': propertyId },
    },
  );
};

export const downloadExport = async (
  propertyId: string,
  jobId: string,
): Promise<Blob> => {
  return apiBlob(`/api/v1/properties/${propertyId}/finance/exports/${jobId}/download`, {
    headers: { 'X-Property-ID': propertyId },
  });
};
