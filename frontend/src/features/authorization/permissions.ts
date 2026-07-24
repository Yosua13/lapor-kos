import type { MembershipRole } from '@/features/properties/types';

export const CAPABILITIES = {
  PROPERTY_READ: 'property.read',
  PROPERTY_CREATE: 'property.create',
  PROPERTY_MANAGE: 'property.update',
  PROPERTY_ARCHIVE: 'property.archive',
  MEMBERSHIP_READ: 'membership.read',
  MEMBERSHIP_MANAGE: 'membership.manage',
  ROOM_READ: 'room.read',
  ROOM_WRITE: 'room.write',
  ROOM_DELETE: 'room.delete',
  TENANT_READ: 'tenant.read',
  TENANT_WRITE: 'tenant.write',
  TENANT_DELETE: 'tenant.delete',
  CONTRACT_READ: 'contract.read',
  CONTRACT_WRITE: 'contract.write',
  CONTRACT_DELETE: 'contract.delete',
  PAYMENT_READ: 'payment.read',
  PAYMENT_WRITE: 'payment.write',
  PAYMENT_VERIFY: 'payment.verify',
  REPORT_READ: 'report.read',
  REPORT_EXPORT: 'report.read',
  COMPLAINT_READ: 'complaint.read',
  COMPLAINT_MANAGE: 'complaint.write',
  RULE_READ: 'house_rule.read',
  RULE_WRITE: 'house_rule.write',
  CALENDAR_READ: 'calendar.read',
  FILE_READ: 'file.read',
  FILE_WRITE: 'file.write',
} as const;

export type Capability = (typeof CAPABILITIES)[keyof typeof CAPABILITIES];

const ALL_CAPABILITIES = Object.values(CAPABILITIES) as Capability[];

export const ROLE_CAPABILITIES: Record<MembershipRole, readonly Capability[]> = {
  property_owner: ALL_CAPABILITIES,
  manager: [
    CAPABILITIES.PROPERTY_READ,
    CAPABILITIES.PROPERTY_MANAGE,
    CAPABILITIES.MEMBERSHIP_READ,
    CAPABILITIES.ROOM_READ,
    CAPABILITIES.ROOM_WRITE,
    CAPABILITIES.ROOM_DELETE,
    CAPABILITIES.TENANT_READ,
    CAPABILITIES.TENANT_WRITE,
    CAPABILITIES.TENANT_DELETE,
    CAPABILITIES.CONTRACT_READ,
    CAPABILITIES.CONTRACT_WRITE,
    CAPABILITIES.CONTRACT_DELETE,
    CAPABILITIES.PAYMENT_READ,
    CAPABILITIES.REPORT_READ,
    CAPABILITIES.COMPLAINT_READ,
    CAPABILITIES.COMPLAINT_MANAGE,
    CAPABILITIES.RULE_READ,
    CAPABILITIES.RULE_WRITE,
    CAPABILITIES.CALENDAR_READ,
    CAPABILITIES.FILE_READ,
    CAPABILITIES.FILE_WRITE,
  ],
  finance: [
    CAPABILITIES.PROPERTY_READ,
    CAPABILITIES.ROOM_READ,
    CAPABILITIES.TENANT_READ,
    CAPABILITIES.CONTRACT_READ,
    CAPABILITIES.PAYMENT_READ,
    CAPABILITIES.PAYMENT_WRITE,
    CAPABILITIES.PAYMENT_VERIFY,
    CAPABILITIES.REPORT_READ,
    CAPABILITIES.REPORT_EXPORT,
    CAPABILITIES.CALENDAR_READ,
    CAPABILITIES.FILE_READ,
  ],
  maintenance: [
    CAPABILITIES.PROPERTY_READ,
    CAPABILITIES.ROOM_READ,
    CAPABILITIES.COMPLAINT_READ,
    CAPABILITIES.COMPLAINT_MANAGE,
    CAPABILITIES.RULE_READ,
    CAPABILITIES.CALENDAR_READ,
    CAPABILITIES.FILE_READ,
    CAPABILITIES.FILE_WRITE,
  ],
  viewer: [
    CAPABILITIES.PROPERTY_READ,
    CAPABILITIES.ROOM_READ,
    CAPABILITIES.CONTRACT_READ,
    CAPABILITIES.PAYMENT_READ,
    CAPABILITIES.REPORT_READ,
    CAPABILITIES.COMPLAINT_READ,
    CAPABILITIES.RULE_READ,
    CAPABILITIES.CALENDAR_READ,
  ],
};

export const hasCapability = (
  role: MembershipRole | null | undefined,
  capability: Capability,
  explicitPermissions?: readonly string[] | null,
): boolean => {
  if (!role) return false;
  if (explicitPermissions?.includes('*') || explicitPermissions?.includes(capability)) return true;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
};

export const getRoleLabel = (role: MembershipRole | null | undefined): string => {
  switch (role) {
    case 'property_owner': return 'Owner Properti';
    case 'manager': return 'Manager';
    case 'finance': return 'Finance';
    case 'maintenance': return 'Maintenance';
    case 'viewer': return 'Viewer';
    default: return 'Tanpa peran';
  }
};
