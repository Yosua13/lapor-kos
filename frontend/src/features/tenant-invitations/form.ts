export type InvitationFormValues = {
  fullName: string;
  email: string;
  phone: string;
};

export type InvitationFormErrors = Partial<Record<keyof InvitationFormValues, string>>;

export const formatIndonesianPhone = (value: string): string => {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits && !digits.startsWith('62')) digits = `62${digits}`;
  digits = digits.slice(0, 14);
  if (digits.length <= 2) return digits ? '+62' : '';
  const rest = digits.slice(2);
  return `+62 ${rest.slice(0, 3)}${rest.length > 3 ? `-${rest.slice(3, 7)}` : ''}${rest.length > 7 ? `-${rest.slice(7, 12)}` : ''}`;
};

export const validateInvitationForm = ({ fullName, email, phone }: InvitationFormValues): InvitationFormErrors => {
  const errors: InvitationFormErrors = {};
  if (!fullName.trim()) errors.fullName = 'Nama lengkap wajib diisi.';
  if (!email.trim()) errors.email = 'Email wajib diisi.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Format email tidak valid.';

  const digits = phone.replace(/\D/g, '');
  if (!phone.trim()) errors.phone = 'Nomor WhatsApp wajib diisi.';
  else if (!digits.startsWith('62') || digits.length < 11 || digits.length > 14) {
    errors.phone = 'Gunakan nomor Indonesia yang valid, misalnya +62 812-3456-7890.';
  }
  return errors;
};
