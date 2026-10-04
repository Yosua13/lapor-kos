import { describe, expect, it } from 'vitest';
import { formatIndonesianPhone, validateInvitationForm } from './form';

describe('tenant invitation form', () => {
  it.each([
    ['081234567890', '+62 812-3456-7890'],
    ['6281234567890', '+62 812-3456-7890'],
    ['+62 812-3456-7890', '+62 812-3456-7890'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(formatIndonesianPhone(input)).toBe(expected);
  });

  it('requires name, email, and WhatsApp number regardless of delivery channel', () => {
    expect(validateInvitationForm({ fullName: '', email: '', phone: '' })).toEqual({
      fullName: 'Nama lengkap wajib diisi.',
      email: 'Email wajib diisi.',
      phone: 'Nomor WhatsApp wajib diisi.',
    });
  });

  it('rejects non-Indonesian and malformed contacts', () => {
    const errors = validateInvitationForm({ fullName: 'Tenant', email: 'invalid', phone: '+1 202 555 0199' });
    expect(errors.email).toBe('Format email tidak valid.');
    expect(errors.phone).toContain('nomor Indonesia');
  });

  it('accepts a complete form', () => {
    expect(validateInvitationForm({
      fullName: 'Tenant Baru',
      email: 'tenant@example.test',
      phone: '+62 812-3456-7890',
    })).toEqual({});
  });
});
