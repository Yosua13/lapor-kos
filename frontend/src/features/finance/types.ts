export type ExpenseCategory =
  | 'maintenance'
  | 'utilities'
  | 'cleaning'
  | 'supplies'
  | 'operational'
  | 'tax_legal'
  | 'marketing'
  | 'staff_salary'
  | 'other';

export type ExpenseStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'cancelled';

export interface Expense {
  id: string;
  property_id: string;
  expense_number: string;
  category: ExpenseCategory;
  vendor_id?: string;
  vendor_name: string;
  title: string;
  description: string;
  amount_minor: number;
  currency: string;
  expense_date: string;
  status: ExpenseStatus;
  payment_method: string;
  proof_file_id?: string;
  proof_file_url?: string;
  is_recurring: boolean;
  recurring_interval?: string;
  created_by?: string;
  created_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  period_close_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ExpenseFilter {
  category?: string;
  status?: string;
  vendor_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface CreateExpensePayload {
  category: ExpenseCategory;
  vendor_id?: string;
  vendor_name?: string;
  title: string;
  description?: string;
  amount_minor: number;
  expense_date: string;
  payment_method?: string;
  proof_file_id?: string;
  is_recurring?: boolean;
  recurring_interval?: string;
  status?: 'draft' | 'pending_approval' | 'approved' | 'paid';
}

export interface UpdateExpensePayload {
  category?: ExpenseCategory;
  vendor_id?: string;
  vendor_name?: string;
  title?: string;
  description?: string;
  amount_minor?: number;
  expense_date?: string;
  payment_method?: string;
  proof_file_id?: string;
  is_recurring?: boolean;
  recurring_interval?: string;
  status?: ExpenseStatus;
}

export interface FinancePeriodClosure {
  id: string;
  property_id: string;
  period_key: string;
  period_start: string;
  period_end: string;
  status: 'closed' | 'locked' | 'reopened';
  closed_by: string;
  closed_by_name?: string;
  closed_at: string;
  reopened_by?: string;
  reopened_by_name?: string;
  reopened_at?: string;
  reopen_reason?: string;
  summary_snapshot: Record<string, unknown>;
  notes: string;
  created_at: string;
  updated_at: string;
  adjustments?: FinancePeriodAdjustment[];
}

export interface FinancePeriodAdjustment {
  id: string;
  property_id: string;
  period_close_id: string;
  adjustment_number: string;
  adjustment_type: 'expense_adjustment' | 'revenue_correction' | 'deposit_adjustment' | 'write_off' | 'other';
  amount_minor: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  requested_by_name?: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  events?: FinancePeriodAdjustmentEvent[];
}

export interface FinancePeriodAdjustmentEvent {
  id: string;
  adjustment_id: string;
  property_id: string;
  actor_id?: string;
  actor_name?: string;
  event_type: 'requested' | 'approved' | 'rejected' | 'note_added';
  previous_status: string;
  new_status: string;
  notes: string;
  created_at: string;
}

export interface FinanceExportJob {
  id: string;
  property_id: string;
  requested_by: string;
  requested_by_name?: string;
  report_type: 'cash_flow' | 'receivables_aging' | 'expense_summary' | 'income_statement' | 'full_ledger';
  period_start: string;
  period_end: string;
  export_format: 'csv' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_name: string;
  file_content?: string;
  total_rows: number;
  checksum_sha256: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
}

export interface AgingInvoiceItem {
  invoice_id: string;
  invoice_number: string;
  tenant_name: string;
  room_number: string;
  due_at: string;
  days_past_due: number;
  total_minor: number;
  outstanding_minor: number;
  aging_bucket: 'current' | '31_60' | '61_90' | '90_plus';
}

export interface ReceivablesAgingSummary {
  current_minor: number;
  due_31_to_60_minor: number;
  due_61_to_90_minor: number;
  overdue_90_plus_minor: number;
  total_outstanding_minor: number;
  invoices: AgingInvoiceItem[];
}

export interface CategoryExpenseSummary {
  category: string;
  category_label: string;
  total_minor: number;
  count: number;
  percentage: number;
}

export interface OccupancyFinancialStats {
  total_rooms: number;
  occupied_rooms: number;
  available_rooms: number;
  occupancy_rate: number;
  potential_monthly_revenue_minor: number;
  actual_monthly_revenue_minor: number;
}

export interface FinancialDashboardSummary {
  property_id: string;
  property_name: string;
  currency: string;
  period_start: string;
  period_end: string;
  is_period_closed: boolean;
  period_closure?: FinancePeriodClosure;
  cash_received_minor: number;
  pending_payments_minor: number;
  deposit_liability_minor: number;
  billed_revenue_minor: number;
  operating_expenses_minor: number;
  net_operating_income_minor: number;
  accrual_net_income_minor: number;
  total_receivable_minor: number;
  receivables_aging: ReceivablesAgingSummary;
  expenses_by_category: CategoryExpenseSummary[];
  occupancy_stats: OccupancyFinancialStats;
}
