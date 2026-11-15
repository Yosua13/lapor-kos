import { apiFetch } from '@/lib/api';
import type {
  CreateRefundPayload,
  Payment,
  PaymentReceipt,
  ProcessRefundPayload,
  ReconciliationReport,
  RefundRequest,
  SnapCallbackResult,
  SnapTokenResponse,
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

const SNAP_SESSION_STORAGE_PREFIX = 'lapor_kos_snap_session_';

export interface StoredSnapSession extends SnapTokenResponse {
  gross_amount: number;
  saved_at: number;
  method_selected?: boolean;
}

export const getStoredSnapSession = (
  paymentId: string,
  grossAmount?: number,
): StoredSnapSession | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(`${SNAP_SESSION_STORAGE_PREFIX}${paymentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSnapSession;
    if (!parsed?.token) return null;
    if (typeof grossAmount === 'number' && grossAmount > 0 && parsed.gross_amount !== grossAmount) {
      return null;
    }
    if (Date.now() - (parsed.saved_at || 0) > 23 * 60 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveSnapSession = (
  paymentId: string,
  grossAmount: number,
  snapData: SnapTokenResponse,
  methodSelected = false,
): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: StoredSnapSession = {
      ...snapData,
      gross_amount: grossAmount,
      saved_at: Date.now(),
      method_selected: methodSelected,
    };
    window.localStorage.setItem(
      `${SNAP_SESSION_STORAGE_PREFIX}${paymentId}`,
      JSON.stringify(payload),
    );
  } catch {
    // ignore storage errors
  }
};

export const clearStoredSnapSession = (paymentId: string): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`${SNAP_SESSION_STORAGE_PREFIX}${paymentId}`);
  } catch {
    // ignore storage errors
  }
};

export const getSnapToken = async (
  paymentId: string,
  options?: { forceNew?: boolean; previousOrderId?: string },
): Promise<SnapTokenResponse> => {
  return apiFetch<SnapTokenResponse>(
    `/api/payments/${paymentId}/snap-token`,
    options?.forceNew
      ? {
          method: 'POST',
          params: {
            force_new: 'true',
            ...(options.previousOrderId ? { previous_order_id: options.previousOrderId } : {}),
          },
          body: JSON.stringify({
            force_new: true,
            previous_order_id: options.previousOrderId || '',
          }),
        }
      : {
          method: 'POST',
        },
  );
};

export const syncMidtransStatus = async (
  paymentId: string,
  orderId?: string,
): Promise<{
  status: string;
  midtrans_status: string;
  payment_status: string;
  payment: Payment;
}> => {
  return apiFetch(`/api/payments/${paymentId}/sync-status`, {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId || '' }),
  });
};

export const syncSnapCallback = async (
  paymentId: string,
  result: SnapCallbackResult,
): Promise<{ status: string; is_duplicate: boolean; payment_status: string; payment: Payment }> => {
  return apiFetch(`/api/payments/${paymentId}/snap-callback`, {
    method: 'POST',
    body: JSON.stringify(result),
  });
};

export const ensureSnapScriptLoaded = async (clientKey?: string): Promise<void> => {
  if (typeof window === 'undefined') return;
  const resolvedKey =
    clientKey ||
    (import.meta.env.VITE_MIDTRANS_CLIENT_KEY as string | undefined) ||
    '';

  const existingScript = document.querySelector<HTMLScriptElement>(
    'script[src*="midtrans.com/snap/snap.js"]',
  );

  if (existingScript && resolvedKey) {
    const currentKey = existingScript.getAttribute('data-client-key') || '';
    if (!currentKey || currentKey.includes('VITE_MIDTRANS_CLIENT_KEY') || currentKey.includes('xxxx')) {
      existingScript.setAttribute('data-client-key', resolvedKey);
    }
  }

  if (window.snap && typeof window.snap.pay === 'function') {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    if (resolvedKey) {
      script.setAttribute('data-client-key', resolvedKey);
    }
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat skrip Midtrans Snap.js'));
    document.head.appendChild(script);
  });
};
