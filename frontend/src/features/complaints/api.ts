import { apiFetch } from '@/lib/api';
import type {
  AISuggestion,
  Complaint,
  ComplaintEvent,
  SLADashboardStats,
  Vendor,
  WorkOrder,
} from './types';

// --- Tenant APIs ---

export const getTenantComplaints = async (): Promise<Complaint[]> => {
  return apiFetch<Complaint[]>('/api/complaints/my');
};

export const getTenantComplaint = async (id: string): Promise<Complaint> => {
  return apiFetch<Complaint>(`/api/complaints/my/${id}`);
};

export const confirmComplaintResolution = async (
  id: string,
  comment?: string,
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/my/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
};

export const reopenComplaint = async (
  id: string,
  reason: string,
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/my/${id}/reopen`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
};

// --- Staff / Owner APIs ---

export const getOwnerComplaints = async (): Promise<Complaint[]> => {
  return apiFetch<Complaint[]>('/api/complaints', {
    propertyScoped: true,
  });
};

export const getComplaint = async (id: string): Promise<Complaint> => {
  return apiFetch<Complaint>(`/api/complaints/${id}`, {
    propertyScoped: true,
  });
};

export const getSLADashboard = async (): Promise<SLADashboardStats> => {
  return apiFetch<SLADashboardStats>('/api/complaints/sla-dashboard', {
    propertyScoped: true,
  });
};

export const triageComplaint = async (
  id: string,
  data: {
    priority: string;
    impact: string;
    access_window?: string;
    first_response_due_at?: string;
    resolution_due_at?: string;
    reason?: string;
  },
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/${id}/triage`, {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

export const assignComplaint = async (
  id: string,
  data: {
    assigned_to?: string;
    notes?: string;
  },
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

export const updateComplaintStatus = async (
  id: string,
  status: string,
  notes?: string,
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes }),
    propertyScoped: true,
  });
};

// --- Timeline APIs ---

export const getComplaintTimeline = async (
  id: string,
  isTenant: boolean,
): Promise<ComplaintEvent[]> => {
  const url = isTenant ? `/api/complaints/my/${id}/timeline` : `/api/complaints/${id}/timeline`;
  return apiFetch<ComplaintEvent[]>(url, {
    propertyScoped: !isTenant,
  });
};

export const addTimelineEvent = async (
  id: string,
  isTenant: boolean,
  data: {
    event_type: string;
    visibility: 'public' | 'internal';
    message: string;
  },
): Promise<ComplaintEvent> => {
  const url = isTenant ? `/api/complaints/my/${id}/events` : `/api/complaints/${id}/events`;
  return apiFetch<ComplaintEvent>(url, {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: !isTenant,
  });
};

// --- AI Suggestion APIs ---

export const getAISuggestion = async (id: string): Promise<AISuggestion> => {
  return apiFetch<AISuggestion>(`/api/complaints/${id}/ai-suggestion`, {
    propertyScoped: true,
  });
};

export const applyAISuggestion = async (
  id: string,
  data: {
    apply_priority: boolean;
    apply_category: boolean;
    apply_draft_response: boolean;
  },
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/${id}/ai-suggestion/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

// --- Work Order APIs ---

export const getWorkOrders = async (complaintId: string): Promise<WorkOrder[]> => {
  return apiFetch<WorkOrder[]>(`/api/complaints/${complaintId}/work-orders`, {
    propertyScoped: true,
  });
};

export const createWorkOrder = async (
  complaintId: string,
  data: {
    vendor_id?: string;
    title: string;
    description?: string;
    scheduled_date?: string;
    estimated_cost: number;
    actual_cost: number;
    invoice_url?: string;
    notes?: string;
  },
): Promise<WorkOrder> => {
  return apiFetch<WorkOrder>(`/api/complaints/${complaintId}/work-orders`, {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

export const updateWorkOrder = async (
  complaintId: string,
  woId: string,
  data: {
    vendor_id?: string;
    title: string;
    description?: string;
    status: string;
    scheduled_date?: string;
    estimated_cost: number;
    actual_cost: number;
    invoice_url?: string;
    notes?: string;
  },
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/complaints/${complaintId}/work-orders/${woId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

// --- Vendor APIs ---

export const getVendors = async (activeOnly: boolean = false): Promise<Vendor[]> => {
  const query = activeOnly ? '?active_only=true' : '';
  return apiFetch<Vendor[]>(`/api/vendors${query}`, {
    propertyScoped: true,
  });
};

export const createVendor = async (data: {
  name: string;
  service_type: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}): Promise<Vendor> => {
  return apiFetch<Vendor>('/api/vendors', {
    method: 'POST',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};

export const updateVendor = async (
  id: string,
  data: {
    name: string;
    service_type: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    is_active: boolean;
  },
): Promise<{ message: string }> => {
  return apiFetch<{ message: string }>(`/api/vendors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    propertyScoped: true,
  });
};
