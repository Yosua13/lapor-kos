export type VisitorPermitStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'change_requested'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type VisitorPermitEventType =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'change_requested'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'anonymized';

export interface VisitorPermit {
  id: string;
  property_id: string;
  tenant_id: string;
  contract_id: string;
  room_id: string;
  guest_name: string;
  guest_phone?: string;
  guest_id_card_last4?: string;
  relationship: string;
  purpose: string;
  is_overnight: boolean;
  start_time: string;
  end_time: string;
  total_guests: number;
  vehicle_type: string;
  vehicle_number?: string;
  status: VisitorPermitStatus;
  pass_token?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  checked_in_by?: string;
  checked_in_at?: string;
  checked_out_by?: string;
  checked_out_at?: string;
  is_anonymized: boolean;
  anonymized_at?: string;
  created_at: string;
  updated_at: string;

  tenant_name?: string;
  tenant_phone?: string;
  room_number?: string;
  property_name?: string;
  is_overstay?: boolean;
}

export interface VisitorPermitEvent {
  id: string;
  visitor_permit_id: string;
  property_id: string;
  actor_id?: string;
  actor_role: string;
  event_type: VisitorPermitEventType;
  reason?: string;
  payload?: Record<string, any>;
  created_at: string;
  actor_name?: string;
}

export interface CreateVisitorPermitInput {
  guest_name: string;
  guest_phone?: string;
  guest_id_card_last4?: string;
  relationship: string;
  purpose: string;
  is_overnight: boolean;
  start_time: string;
  end_time: string;
  total_guests?: number;
  vehicle_type?: string;
  vehicle_number?: string;
}

export interface VisitorPassVerification {
  pass_token: string;
  property_name: string;
  room_number: string;
  guest_name_masked: string;
  relationship: string;
  purpose: string;
  is_overnight: boolean;
  start_time: string;
  end_time: string;
  total_guests: number;
  vehicle_type: string;
  vehicle_number?: string;
  status: string;
  is_valid: boolean;
  is_overstay: boolean;
  checked_in_at?: string;
  checked_out_at?: string;
}

export interface VisitorPermitSummary {
  total_today: number;
  active_count: number;
  pending_count: number;
  overstay_count: number;
  rejected_count: number;
}

export interface ListVisitorPermitsParams {
  status?: string;
  from_date?: string;
  to_date?: string;
  is_overnight?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}
