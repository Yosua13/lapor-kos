export type CheckoutStatus =
  | 'submitted'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'settlement_pending'
  | 'approved'
  | 'completed'
  | 'cancelled';

export type InspectionCondition = 'good' | 'fair' | 'damaged' | 'missing' | 'dirty';

export interface CheckoutInspection {
  id: string;
  property_id: string;
  checkout_id: string;
  item_name: string;
  condition: InspectionCondition;
  repair_cost_minor: number;
  photo_url?: string;
  notes?: string;
  inspected_at: string;
}

export type SettlementType = 'refund' | 'invoice' | 'zero_balance';
export type DepositStatus =
  | 'pending'
  | 'refund_requested'
  | 'refund_approved'
  | 'applied_to_deductions'
  | 'forfeited'
  | 'zero_balance';

export interface CheckoutSettlement {
  id: string;
  property_id: string;
  checkout_id: string;
  currency: string;
  deposit_held_minor: number;
  unpaid_invoices_minor: number;
  prorata_rent_minor: number;
  damage_charges_minor: number;
  utility_charges_minor: number;
  credit_balance_minor: number;
  other_charges_minor: number;
  net_settlement_minor: number;
  settlement_type: SettlementType;
  deposit_status: DepositStatus;
  refund_request_id?: string;
  final_invoice_id?: string;
  calculation_snapshot?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SettlementCalculation {
  currency: string;
  deposit_held_minor: number;
  credit_balance_minor: number;
  total_available_funds_minor: number;
  unpaid_invoices_minor: number;
  prorata_rent_minor: number;
  damage_charges_minor: number;
  utility_charges_minor: number;
  other_charges_minor: number;
  total_deductions_minor: number;
  net_settlement_minor: number;
  settlement_type: SettlementType;
  refund_amount_minor: number;
  invoice_amount_minor: number;
  deposit_applied_to_deductions_minor: number;
  deposit_status: string;
  snapshot?: Record<string, unknown>;
}

export interface CheckoutCase {
  id: string;
  property_id: string;
  contract_id: string;
  tenant_id: string;
  room_id: string;
  status: CheckoutStatus;
  scheduled_checkout_date: string;
  actual_checkout_date?: string;
  reason: string;
  forwarding_address?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  inspection_notes?: string;
  inspected_by?: string;
  inspected_at?: string;
  key_returned: boolean;
  key_returned_at?: string;
  room_override: boolean;
  room_override_reason?: string;
  approved_by?: string;
  approved_at?: string;
  completed_by?: string;
  completed_at?: string;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;

  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  room_number?: string;
  room_floor?: string;
  contract_start?: string;
  contract_end?: string;

  inspections?: CheckoutInspection[];
  settlement?: CheckoutSettlement;
}

export interface CreateCheckoutNoticeRequest {
  contract_id: string;
  scheduled_checkout_date: string;
  reason: string;
  forwarding_address?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
}

export interface InspectionItemInput {
  item_name: string;
  condition: InspectionCondition;
  repair_cost_minor: number;
  photo_url?: string;
  notes?: string;
}

export interface UtilityReadingInput {
  previous_value: number;
  current_value: number;
  unit_price_minor: number;
}

export interface RecordInspectionRequest {
  items: InspectionItemInput[];
  key_returned: boolean;
  inspection_notes?: string;
  electricity_reading?: UtilityReadingInput;
  water_reading?: UtilityReadingInput;
}

export interface ExecuteCheckoutRequest {
  actual_checkout_date?: string;
  target_room_status?: string; // cleaning, available
  room_override?: boolean;
  room_override_reason?: string;
}

export interface RoomOverrideRequest {
  target_room_status: string;
  reason: string;
}
