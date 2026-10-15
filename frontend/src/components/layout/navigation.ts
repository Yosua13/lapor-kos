import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Building2,
  Calendar,
  CreditCard,
  DoorOpen,
  FileText,
  ReceiptText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users,
  Bell,
  UserCheck,
} from 'lucide-react';
import { CAPABILITIES, type Capability } from '@/features/authorization/permissions';

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  capability?: Capability;
}

export interface NavigationSection {
  section: string;
  items: NavigationItem[];
}

const tenantNavigation: NavigationSection[] = [
  {
    section: 'PORTAL PENGHUNI',
    items: [
      { name: 'Dashboard Saya', href: '/', icon: LayoutDashboard },
      { name: 'Invoice Saya', href: '/invoices', icon: ReceiptText },
      { name: 'Bayar', href: '/payments', icon: CreditCard },
      { name: 'Izin Tamu', href: '/guest-permits', icon: UserCheck },
      { name: 'Peraturan Kos', href: '/rules', icon: BookOpen },
    ],
  },
  {
    section: 'LAINNYA',
    items: [
      { name: 'Notifikasi', href: '/notifications', icon: Bell },
      { name: 'Komplain Fasilitas', href: '/complaints', icon: MessageSquare },
      { name: 'Pengaturan Akun', href: '/settings', icon: Settings },
    ],
  },
];

const staffNavigation: NavigationSection[] = [
  {
    section: 'MENU UTAMA',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Manajemen Kamar', href: '/rooms', icon: DoorOpen, capability: CAPABILITIES.ROOM_READ },
      { name: 'Penghuni & Kontrak', href: '/tenants', icon: Users, capability: CAPABILITIES.TENANT_READ },
    ],
  },
  {
    section: 'KEUANGAN',
    items: [
      { name: 'Invoice & Tagihan', href: '/invoices', icon: ReceiptText, capability: CAPABILITIES.INVOICE_READ },
      { name: 'Pembayaran', href: '/payments', icon: CreditCard, capability: CAPABILITIES.PAYMENT_READ },
      { name: 'Laporan', href: '/reports', icon: FileText, capability: CAPABILITIES.REPORT_READ },
    ],
  },
  {
    section: 'OPERASIONAL',
    items: [
      { name: 'Izin Tamu & Pengunjung', href: '/guest-permits', icon: UserCheck, capability: CAPABILITIES.VISITOR_PERMIT_READ },
      { name: 'Peraturan Kos', href: '/rules', icon: BookOpen, capability: CAPABILITIES.RULE_READ },
      { name: 'Kalender', href: '/calendar', icon: Calendar, capability: CAPABILITIES.CALENDAR_READ },
      { name: 'Komplain', href: '/complaints', icon: MessageSquare, capability: CAPABILITIES.COMPLAINT_READ },
    ],
  },
  {
    section: 'ADMINISTRASI',
    items: [
      { name: 'Notifikasi & Delivery', href: '/notifications', icon: Bell },
      { name: 'Properti & Tim', href: '/properties', icon: Building2 },
      { name: 'Pengaturan Akun', href: '/settings', icon: Settings },
    ],
  },
];

export const getNavigation = (
  isTenant: boolean,
  can: (capability: Capability) => boolean,
): NavigationSection[] => {
  if (isTenant) return tenantNavigation;
  return staffNavigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.capability || can(item.capability)),
    }))
    .filter((section) => section.items.length > 0);
};

const staffPathCapabilities: Array<[string, Capability]> = [
  ['/rooms', CAPABILITIES.ROOM_READ],
  ['/tenants', CAPABILITIES.TENANT_READ],
	['/contracts', CAPABILITIES.CONTRACT_READ],
  ['/invoices', CAPABILITIES.INVOICE_READ],
  ['/payments', CAPABILITIES.PAYMENT_READ],
  ['/reports', CAPABILITIES.REPORT_READ],
  ['/rules', CAPABILITIES.RULE_READ],
  ['/calendar', CAPABILITIES.CALENDAR_READ],
  ['/complaints', CAPABILITIES.COMPLAINT_READ],
  ['/guest-permits', CAPABILITIES.VISITOR_PERMIT_READ],
];

export const getRequiredCapability = (pathname: string): Capability | null => (
  staffPathCapabilities.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? null
);

export const isStaffOnlyPath = (pathname: string): boolean => (
  ['/rooms', '/tenants', '/reports', '/calendar', '/properties']
    .some((path) => pathname === path || pathname.startsWith(`${path}/`))
);

