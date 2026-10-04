export type ContractStatus = 'draft' | 'pending_tenant' | 'scheduled' | 'active' | 'ended' | 'terminated' | 'renewed' | 'cancelled';

export interface ContractVersion {
  id: string;
  version_number: number;
  snapshot: Record<string, unknown>;
  reason: string;
  created_at: string;
}

export interface ContractEvent {
  id: string;
  event_type: string;
  from_status?: string;
  to_status?: string;
  reason: string;
  created_at: string;
}

export interface OccupancyPeriod {
  id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  closed_at?: string;
}

export interface ContractDocument {
  id: string;
  version_number: number;
  file_name: string;
  sha256: string;
  size_bytes: number;
  published_at: string;
}

export interface ContractDetail {
  id: string;
  property_id: string;
  room_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  rental_duration: number;
  monthly_rent: number;
  total_price: number;
  deposit: number;
  payment_interval: string;
  payment_due_day: number;
  status: ContractStatus;
  notes: string;
  room?: { room_number: string };
  user?: { name: string; phone?: string };
  versions: ContractVersion[];
  events: ContractEvent[];
  occupancy_periods: OccupancyPeriod[];
  documents: ContractDocument[];
}

export const STATUS_LABELS: Record<ContractStatus, string> = {
  draft: 'Draft', pending_tenant: 'Menunggu tenant', scheduled: 'Terjadwal', active: 'Aktif',
  ended: 'Berakhir', terminated: 'Dihentikan', renewed: 'Diperpanjang', cancelled: 'Dibatalkan',
};

const OWNER_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ['pending_tenant', 'cancelled'],
  pending_tenant: ['cancelled'],
  scheduled: ['active', 'cancelled'],
  active: ['ended', 'terminated'],
  ended: [], terminated: [], renewed: [], cancelled: [],
};

export const ownerTransitions = (status: ContractStatus): ContractStatus[] => OWNER_TRANSITIONS[status];
