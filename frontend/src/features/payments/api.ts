import { apiFetch } from '@/lib/api';
import type {
  CreateRefundPayload,
  Payment,
  PaymentReceipt,
  ProcessRefundPayload,
  ReconciliationReport,
  RefundRequest,
  VerifyPaymentPayload,
} from './types';

export const listPayments = async (
  isTenant: boolean,
  params?: Record<string, string>,
): Promise<Payment[]> => {
  if (isTenant) {
    return apiFetch<Payment[]>('/api/payments/my');
  }
  return apiFetch<Payment[]>('/api/payments', {
    params,
    propertyScoped: true,
  });
};

export const getPayment = async (
  id: string,
  isTenant = false,
): Promise<Payment> => {
  return apiFetch<Payment>(`/api/payments/${id}`, {
    propertyScoped: !isTenant,
  });
};

export const submitPaymentProof = async (
  id: string,
  formData: FormData,
): Promise<{ message: string; proof_url: string }> => {
  return apiFetch<{ message: string; proof_url: string }>(`/api/payments/${id}/submit`, {
    method: 'POST',
    body: formData,
  });
};

export const verifyPayment = async (
  id: string,
  payload: VerifyPaymentPayload,
): Promise<Payment> => {
  return apiFetch<Payment>(`/api/payments/${id}/verify`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    propertyScoped: true,
  });
};

export const getReceipt = async (
  id: string,
  isTenant = false,
): Promise<PaymentReceipt> => {
  return apiFetch<PaymentReceipt>(`/api/payments/${id}/receipt-data`, {
    propertyScoped: !isTenant,
  });
};

export const getReconciliationReport = async (
  startDate?: string,
  endDate?: string,
): Promise<ReconciliationReport> => {
  const params: Record<string, string> = {};
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  return apiFetch<ReconciliationReport>('/api/payments/reconciliation', {
    params,
    propertyScoped: true,
  });
};

export const createRefund = async (
  payload: CreateRefundPayload,
): Promise<RefundRequest> => {
  return apiFetch<RefundRequest>('/api/payments/refunds', {
    method: 'POST',
    body: JSON.stringify(payload),
    propertyScoped: true,
  });
};

export const processRefund = async (
  id: string,
  payload: ProcessRefundPayload,
): Promise<RefundRequest> => {
  return apiFetch<RefundRequest>(`/api/payments/refunds/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
    propertyScoped: true,
  });
};

export const createPaymentBill = async (
  payload: Record<string, any>,
): Promise<Payment> => {
  return apiFetch<Payment>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
    propertyScoped: true,
  });
};
