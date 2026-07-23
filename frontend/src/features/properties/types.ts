export type MembershipRole = 'property_owner' | 'manager' | 'finance' | 'maintenance' | 'viewer';

export type PropertyStatus = 'active' | 'inactive' | string;

export interface PropertySummary {
  id: string;
  name: string;
  address?: string | null;
  timezone: string;
  currency: string;
  status: PropertyStatus;
  membership_id: string;
  role: MembershipRole;
  permissions?: string[] | null;
}

export interface PropertyPayload {
  name: string;
  address?: string;
  timezone: string;
  currency: string;
  status?: PropertyStatus;
}

export interface PropertyMember {
  id?: string;
  membership_id?: string;
  user_id: string;
  name?: string;
  email: string;
  role: MembershipRole;
  status: PropertyStatus;
}

export interface PropertyMemberPayload {
  email: string;
  role: Exclude<MembershipRole, 'property_owner'>;
}
