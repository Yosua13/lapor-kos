export interface InvoiceItem {
  id: string;
  item_type: 'rent' | 'electricity' | 'water' | 'utility_meter' | 'one_off' | 'discount' | 'credit' | 'late_fee' | 'adjustment';
  description: string;
  quantity: string;
  unit_amount_minor: number;
  amount_minor: number;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvoiceEvent {
  id: string;
  event_type: string;
  reason: string;
  metadata: Record<string, unknown>;
  actor_id?: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  property_id: string;
  contract_id: string;
  tenant_id: string;
  source_invoice_id?: string;
  invoice_number: string;
  billing_period: string;
  invoice_type: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  currency: string;
  due_at: string;
  total_minor: number;
  allocated_minor: number;
  credit_applied_minor: number;
  outstanding_minor: number;
  calculation_snapshot: Record<string, unknown>;
  tenant_name?: string;
  room_number?: string;
  items?: InvoiceItem[];
  events?: InvoiceEvent[];
  adjustments?: Invoice[];
}

export interface InvoiceList {
  items: Invoice[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface BillingPolicy {
  id: string;
  property_id: string;
  timezone: string;
  due_day: number;
  generate_days_before: number;
  generation_time: string;
  invalid_day_policy: 'last_day';
  late_fee_enabled: boolean;
  late_fee_type: 'fixed' | 'percentage';
  late_fee_value_minor: number;
  late_fee_grace_days: number;
  updated_at: string;
}

export interface BillingJob {
  id: string;
  billing_period: string;
  status: string;
  contracts_seen: number;
  invoices_created: number;
  invoices_skipped: number;
  error_summary?: string;
  started_at: string;
  finished_at?: string;
}

export interface MeterReadingPayload {
  contract_id: string;
  billing_period: string;
  utility_type: 'electricity' | 'water' | 'other';
  previous_value: number;
  current_value: number;
  unit_price_minor: number;
  notes?: string;
}

export interface AdjustmentPayload {
  description: string;
  amount_minor: number;
  reason: string;
}

export interface AdjustmentPreview {
  source_invoice_id: string;
  current_outstanding_minor: number;
  adjustment_minor: number;
  combined_outstanding_minor: number;
  reason: string;
}
