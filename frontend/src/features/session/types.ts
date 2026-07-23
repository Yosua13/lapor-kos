export type AccountRole = 'owner' | 'tenant' | string;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AccountRole;
  whatsapp_group_link?: string | null;
}

