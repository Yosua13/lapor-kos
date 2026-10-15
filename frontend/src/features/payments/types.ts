export type PaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'partial'
  | 'overdue'
  | 'rejected'
  | 'refunded'
  | 'void';

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'disbursed';

export interface PaymentProof {
  id: string;
  property_id: string;
  payment_id: string;
  file_url: string;
  amount_minor: number;
  payment_method: string;
  submitted_by?: string;
  notes: string;
  created_at: string;
}

export interface PaymentReceipt {
  id: string;
  property_id: string;
  payment_id: string;
  receipt_number: string;
  tenant_id: string;
  total_minor: number;
  currency: string;
  snapshot: Record<string, any>;
  checksum: string;
  issued_by?: string;
  issued_at: string;
  created_at: string;
}

export interface InvoiceAllocation {
  id: string;
  property_id: string;
  invoice_id: string;
  payment_id?: string;
  amount_minor: number;
  status: 'valid' | 'void';
  reason: string;
  created_by?: string;
  created_at: string;
}

export interface TenantCredit {
  id: string;
  property_id: string;
  tenant_id: string;
  source_payment_id?: string;
  amount_minor: number;
  balance_after_minor: number;
  reason: string;
  created_by?: string;
  created_at: string;
}

export interface RefundRequest {
  id: string;
  property_id: string;
  payment_id: string;
  tenant_id: string;
  amount_minor: number;
  status: RefundStatus;
  reason: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
  processed_by?: string;
  processed_at?: string;
  disbursement_ref?: string;
  notes?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  property_id: string;
  contract_id: string;
  tenant_id?: string;
  owner_id?: string;
  period_month: number;
  period_year: number;
  amount_rent: number;
  amount_electricity: number;
  amount_water: number;
  amount_other: number;
  total_paid: number;
  amount_minor: number;
  paid_amount_minor: number;
  currency: string;
  payment_method: string;
  provider: string;
  provider_ref?: string;
  status: PaymentStatus;
  proof_photo_url: string;
  paid_at?: string;
  due_date: string;
  notes: string;
  verified_by?: string;
  verified_at?: string;
  verification_notes?: string;
  rejection_reason?: string;
  invoice_id?: string;
  parent_payment_id?: string;
  created_at: string;

  contract?: {
    id: string;
    monthly_rent?: number;
    deposit?: number;
    payment_due_day?: number;
    room?: {
      room_number: string;
      price_per_month?: number;
    };
    user?: {
      id: string;
      name: string;
      phone: string;
    };
  };
  proofs?: PaymentProof[];
  allocations?: InvoiceAllocation[];
  receipt?: PaymentReceipt;
}

export interface AllocationInput {
  invoice_id: string;
  amount_minor: number;
  reason?: string;
}

export interface VerifyPaymentPayload {
  amount_rent?: number;
  amount_electricity?: number;
  amount_water?: number;
  amount_other?: number;
  total_paid?: number;
  paid_amount_minor?: number;
  status: PaymentStatus;
  notes?: string;
  rejection_reason?: string;
  allocations?: AllocationInput[];
  credit_overpayment?: boolean;
}

export interface CreateRefundPayload {
  payment_id: string;
  amount_minor: number;
  reason: string;
  bank_name: string;
  bank_account_number: string;
  bank_account_holder: string;
}

export interface ProcessRefundPayload {
  status: RefundStatus;
  disbursement_ref?: string;
  notes?: string;
}

export interface ReconciliationReport {
  property_id: string;
  period_start: string;
  period_end: string;
  total_payments_received_minor: number;
  total_allocated_minor: number;
  total_unallocated_minor: number;
  total_credits_created_minor: number;
  total_refunded_minor: number;
  total_settlement_minor: number;
  is_balanced: boolean;
  payments?: Payment[];
  allocations?: InvoiceAllocation[];
  refunds?: RefundRequest[];
  credits?: TenantCredit[];
}
