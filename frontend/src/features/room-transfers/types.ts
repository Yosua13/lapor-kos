export type RoomTransferStatus = 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled';

export interface TransferCalculation {
  contract_id: string;
  from_room_id: string;
  from_room_number: string;
  from_room_price_minor: number;
  to_room_id: string;
  to_room_number: string;
  to_room_price_minor: number;
  effective_date: string;
  target_end_date: string;
  billing_period_start: string;
  billing_period_end: string;
  days_in_period: number;
  active_days_remaining: number;
  unused_old_rent_prorated_minor: number;
  new_rent_prorated_minor: number;
  rent_difference_minor: number;
  deposit_old_minor: number;
  deposit_new_minor: number;
  deposit_difference_minor: number;
  move_fee_minor: number;
  tenant_credit_balance_minor: number;
  credit_applied_minor: number;
  net_total_adjustment_minor: number;
  outstanding_invoices_minor: number;
  currency: string;
}

export interface RoomTransfer {
  id: string;
  property_id: string;
  contract_id: string;
  tenant_id: string;
  from_room_id: string;
  to_room_id: string;
  requested_by: string;
  effective_date: string;
  target_end_date: string;
  status: RoomTransferStatus;
  reason: string;
  rejection_reason?: string;
  approved_by?: string;
  approved_at?: string;
  completed_at?: string;
  calculation_preview: TransferCalculation;
  adjustment_invoice_id?: string;
  created_at: string;
  updated_at: string;
  tenant_name?: string;
  tenant_email?: string;
  tenant_phone?: string;
  from_room_number?: string;
  to_room_number?: string;
  requested_by_name?: string;
  approved_by_name?: string;
}

export interface TenantRoomHistoryItem {
  id: string;
  property_id: string;
  contract_id: string;
  room_id: string;
  room_number: string;
  room_type: string;
  price_per_month_minor: number;
  user_id: string;
  tenant_name: string;
  start_date: string;
  end_date: string;
  closed_at?: string;
  is_current: boolean;
  transfer_id?: string;
  transfer_reason?: string;
  created_at: string;
}

export interface PreviewTransferRequest {
  contract_id?: string;
  tenant_id?: string;
  to_room_id: string;
  effective_date: string;
  move_fee_minor?: number;
}

export interface CreateTransferRequest {
  contract_id?: string;
  tenant_id?: string;
  to_room_id: string;
  effective_date: string;
  reason: string;
  move_fee_minor?: number;
}
