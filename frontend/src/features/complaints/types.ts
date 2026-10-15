export type ComplaintPriority = 'urgent' | 'high' | 'medium' | 'low';
export type ComplaintImpact = 'emergency' | 'major' | 'minor';
export type ComplaintStatus =
  | 'pending'
  | 'in_progress'
  | 'scheduled'
  | 'waiting_vendor'
  | 'resolved'
  | 'confirmed'
  | 'reopened'
  | 'cancelled'
  | 'processed';

export type SLAStatus = 'within_sla' | 'warning' | 'breached';

export type EventVisibility = 'public' | 'internal';

export type WorkOrderStatus =
  | 'draft'
  | 'assigned'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface Complaint {
  id: string;
  property_id: string;
  user_id: string;
  owner_id: string;
  room_id: string;
  title: string;
  description: string;
  category: string;
  priority: ComplaintPriority;
  impact: ComplaintImpact;
  status: ComplaintStatus;
  access_window?: string;
  preferred_contact?: string;
  assigned_to?: string;
  photo_url?: string;
  ai_response?: string;
  wa_sent: boolean;
  wa_message?: string;
  first_response_at?: string;
  resolved_at?: string;
  confirmed_resolved_at?: string;
  reopened_at?: string;
  first_response_due_at?: string;
  resolution_due_at?: string;
  sla_status: SLAStatus;
  created_at: string;
  updated_at: string;

  // Virtual fields
  room_number?: string;
  user_name?: string;
  assignee_name?: string;
  work_orders_count?: number;
  has_ai_suggestion?: boolean;
}

export interface ComplaintEvent {
  id: string;
  complaint_id: string;
  property_id: string;
  actor_id?: string;
  actor_name: string;
  actor_role: string;
  event_type: string;
  visibility: EventVisibility;
  message: string;
  payload?: Record<string, any>;
  created_at: string;
}

export interface Vendor {
  id: string;
  property_id: string;
  name: string;
  service_type: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkOrder {
  id: string;
  complaint_id: string;
  property_id: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_phone?: string;
  title: string;
  description?: string;
  status: WorkOrderStatus;
  scheduled_date?: string;
  estimated_cost: number;
  actual_cost: number;
  invoice_url?: string;
  notes?: string;
  created_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface AISuggestion {
  id: string;
  complaint_id: string;
  property_id: string;
  suggested_category: string;
  suggested_priority: ComplaintPriority;
  suggested_impact: ComplaintImpact;
  summary: string;
  draft_response: string;
  recommended_action: string;
  confidence_score: number;
  model_version: string;
  is_applied: boolean;
  applied_by?: string;
  applied_at?: string;
  created_at: string;
}

export interface SLADashboardStats {
  total_complaints: number;
  open_complaints: number;
  breached_count: number;
  warning_count: number;
  avg_first_response_minutes: number;
  avg_resolution_minutes: number;
  compliance_rate: number;
  priority_breakdown: Record<string, number>;
  status_breakdown: Record<string, number>;
  high_priority_pending_alert: number;
}
