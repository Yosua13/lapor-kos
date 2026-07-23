import { apiFetch } from '@/lib/api';
import type {
  MembershipRole,
  PropertyMember,
  PropertyMemberPayload,
  PropertyPayload,
  PropertySummary,
} from './types';

type PropertiesResponse = { properties: PropertySummary[] } | PropertySummary[];
type MembersResponse = { members: PropertyMember[] } | PropertyMember[];

export const listProperties = async (): Promise<PropertySummary[]> => {
  const response = await apiFetch<PropertiesResponse>('/api/properties', { propertyScoped: false });
  return Array.isArray(response) ? response : response.properties ?? [];
};

export const createProperty = async (payload: PropertyPayload): Promise<PropertySummary | null> => {
  const response = await apiFetch<PropertySummary | { property: PropertySummary }>('/api/properties', {
    method: 'POST',
    body: JSON.stringify(payload),
    propertyScoped: false,
  });
  return 'property' in response ? response.property : response;
};

export const updateProperty = async (
  propertyId: string,
  payload: Partial<PropertyPayload>,
): Promise<PropertySummary | null> => {
  const response = await apiFetch<PropertySummary | { property: PropertySummary }>(`/api/properties/${propertyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    propertyScoped: false,
  });
  return 'property' in response ? response.property : response;
};

export const listPropertyMembers = async (propertyId: string): Promise<PropertyMember[]> => {
  const response = await apiFetch<MembersResponse>(`/api/properties/${propertyId}/members`, { propertyScoped: false });
  return Array.isArray(response) ? response : response.members ?? [];
};

export const addPropertyMember = async (
  propertyId: string,
  payload: PropertyMemberPayload,
): Promise<PropertyMember> => {
  const response = await apiFetch<PropertyMember | { member: PropertyMember }>(`/api/properties/${propertyId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload),
    propertyScoped: false,
  });
  return 'member' in response ? response.member : response;
};

export const updatePropertyMember = async (
  propertyId: string,
  membershipId: string,
  payload: { role: MembershipRole; status?: string },
): Promise<PropertyMember> => {
  const response = await apiFetch<PropertyMember | { member: PropertyMember }>(`/api/properties/${propertyId}/members/${membershipId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    propertyScoped: false,
  });
  return 'member' in response ? response.member : response;
};

export const deletePropertyMember = async (propertyId: string, membershipId: string): Promise<void> => {
  await apiFetch<void>(`/api/properties/${propertyId}/members/${membershipId}`, {
    method: 'DELETE',
    propertyScoped: false,
  });
};
