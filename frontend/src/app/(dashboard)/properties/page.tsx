'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Building2, Loader2, MapPin, Pencil, Plus, RefreshCw, Shield, Trash2, Users } from 'lucide-react';
import { CAPABILITIES, getRoleLabel } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import {
  addPropertyMember,
  createProperty,
  deletePropertyMember,
  listPropertyMembers,
  updateProperty,
  updatePropertyMember,
} from '@/features/properties/api';
import { useActiveProperty } from '@/features/properties/PropertyProvider';
import type { MembershipRole, PropertyMember, PropertyPayload } from '@/features/properties/types';
import { useSession } from '@/features/session/SessionProvider';

const defaultPropertyForm: PropertyPayload = {
  name: '',
  address: '',
  timezone: 'Asia/Jakarta',
  currency: 'IDR',
};

const assignableRoles: Exclude<MembershipRole, 'property_owner'>[] = ['manager', 'finance', 'maintenance', 'viewer'];

const getMembershipId = (member: PropertyMember): string => member.membership_id || member.id || '';

export default function PropertiesPage() {
  const { user } = useSession();
  const { properties, activeProperty, switchProperty, refreshProperties } = useActiveProperty();
  const { can } = useAuthorization();
  const [propertyForm, setPropertyForm] = useState<PropertyPayload>(defaultPropertyForm);
  const [isCreating, setIsCreating] = useState(properties.length === 0);
  const [isSavingProperty, setIsSavingProperty] = useState(false);
  const [members, setMembers] = useState<PropertyMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<Exclude<MembershipRole, 'property_owner'>>('manager');
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canCreate = activeProperty ? can(CAPABILITIES.PROPERTY_CREATE) : user?.role === 'owner';
  const canManageProperty = can(CAPABILITIES.PROPERTY_MANAGE);
  const canManageMembers = can(CAPABILITIES.MEMBERSHIP_MANAGE);

  useEffect(() => {
    if (!activeProperty || isCreating) return;
    // Reset the editor when the externally selected property changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPropertyForm({
      name: activeProperty.name,
      address: activeProperty.address || '',
      timezone: activeProperty.timezone || 'Asia/Jakarta',
      currency: activeProperty.currency || 'IDR',
      status: activeProperty.status,
    });
  }, [activeProperty, isCreating]);

  const loadMembers = async () => {
    if (!activeProperty || !canManageMembers) {
      setMembers([]);
      return;
    }
    setIsLoadingMembers(true);
    try {
      setMembers(await listPropertyMembers(activeProperty.id));
    } catch (caught) {
      setMessage({ type: 'error', text: caught instanceof Error ? caught.message : 'Gagal memuat anggota' });
    } finally {
      setIsLoadingMembers(false);
    }
  };

  useEffect(() => {
    // Membership data follows the active property boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMembers();
    // `loadMembers` intentionally follows the currently active property.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProperty?.id, canManageMembers]);

  const resetMessage = () => setMessage(null);

  const handleSelectProperty = (propertyId: string) => {
    resetMessage();
    setIsCreating(false);
    switchProperty(propertyId, false);
  };

  const handleStartCreate = () => {
    resetMessage();
    setPropertyForm(defaultPropertyForm);
    setIsCreating(true);
  };

  const handleSaveProperty = async (event: FormEvent) => {
    event.preventDefault();
    if (!propertyForm.name.trim()) return;
    setIsSavingProperty(true);
    resetMessage();
    try {
      if (isCreating) {
        const created = await createProperty({ ...propertyForm, name: propertyForm.name.trim() });
        const refreshed = await refreshProperties();
        const createdId = created?.id || refreshed.find((property) => property.name === propertyForm.name.trim())?.id;
        if (createdId) switchProperty(createdId, false);
        setIsCreating(false);
        setMessage({ type: 'success', text: 'Properti berhasil dibuat.' });
      } else if (activeProperty && canManageProperty) {
        await updateProperty(activeProperty.id, propertyForm);
        await refreshProperties();
        setMessage({ type: 'success', text: 'Informasi properti berhasil diperbarui.' });
      }
    } catch (caught) {
      setMessage({ type: 'error', text: caught instanceof Error ? caught.message : 'Gagal menyimpan properti' });
    } finally {
      setIsSavingProperty(false);
    }
  };

  const handleAddMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeProperty || !memberEmail.trim()) return;
    setIsSavingMember(true);
    resetMessage();
    try {
      await addPropertyMember(activeProperty.id, { email: memberEmail.trim(), role: memberRole });
      setMemberEmail('');
      setMemberRole('manager');
      await loadMembers();
      setMessage({ type: 'success', text: 'Anggota berhasil ditambahkan.' });
    } catch (caught) {
      setMessage({ type: 'error', text: caught instanceof Error ? caught.message : 'Gagal menambahkan anggota' });
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleRoleChange = async (member: PropertyMember, role: MembershipRole) => {
    if (!activeProperty) return;
    const membershipId = getMembershipId(member);
    if (!membershipId) return;
    try {
      await updatePropertyMember(activeProperty.id, membershipId, { role });
      await loadMembers();
      setMessage({ type: 'success', text: 'Peran anggota berhasil diperbarui.' });
    } catch (caught) {
      setMessage({ type: 'error', text: caught instanceof Error ? caught.message : 'Gagal memperbarui peran' });
    }
  };

  const handleRemoveMember = async (member: PropertyMember) => {
    if (!activeProperty || member.role === 'property_owner') return;
    const membershipId = getMembershipId(member);
    if (!membershipId || !window.confirm(`Hapus akses ${member.email} dari properti ini?`)) return;
    try {
      await deletePropertyMember(activeProperty.id, membershipId);
      await loadMembers();
      setMessage({ type: 'success', text: 'Akses anggota berhasil dihapus.' });
    } catch (caught) {
      setMessage({ type: 'error', text: caught instanceof Error ? caught.message : 'Gagal menghapus anggota' });
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-teal">Administrasi</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-brand-navy">Properti & Tim</h1>
          <p className="mt-1 text-sm text-brand-navy/50">Kelola identitas properti dan akses staf dari satu tempat.</p>
        </div>
        {canCreate && (
          <button type="button" onClick={handleStartCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white shadow-lg shadow-brand-teal/15">
            <Plus className="h-4 w-4" /> Tambah properti
          </button>
        )}
      </div>

      {message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-[28px] border border-brand-navy/10 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold text-brand-navy">Properti saya</h2>
            <button type="button" onClick={() => void refreshProperties()} aria-label="Muat ulang properti" className="rounded-lg p-2 text-brand-navy/40 hover:bg-brand-navy/5"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <div className="space-y-3">
            {properties.map((property) => (
              <button
                type="button"
                key={property.id}
                onClick={() => handleSelectProperty(property.id)}
                className={`w-full rounded-2xl border p-4 text-left transition-colors ${activeProperty?.id === property.id && !isCreating ? 'border-brand-teal bg-brand-teal/5' : 'border-brand-navy/10 hover:border-brand-teal/30'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal"><Building2 className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-brand-navy">{property.name}</p>
                    <p className="mt-1 truncate text-xs text-brand-navy/45">{property.address || 'Alamat belum diisi'}</p>
                    <span className="mt-2 inline-block rounded-full bg-brand-navy/5 px-2 py-1 text-[10px] font-bold uppercase text-brand-navy/60">{getRoleLabel(property.role)}</span>
                  </div>
                </div>
              </button>
            ))}
            {!properties.length && <p className="rounded-2xl border border-dashed border-brand-navy/15 p-5 text-center text-sm text-brand-navy/45">Belum ada properti.</p>}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-[28px] border border-brand-navy/10 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">{isCreating ? <Plus className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}</div>
              <div>
                <h2 className="font-bold text-brand-navy">{isCreating ? 'Properti baru' : 'Informasi properti'}</h2>
                <p className="text-xs text-brand-navy/45">Nama dan preferensi operasional properti.</p>
              </div>
            </div>

            <form onSubmit={handleSaveProperty} className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-brand-navy">
                <span>Nama properti</span>
                <input required value={propertyForm.name} onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })} disabled={!isCreating && !canManageProperty} className="w-full rounded-xl border border-brand-navy/10 px-4 py-3 outline-none focus:border-brand-teal disabled:bg-gray-50" placeholder="Kos Melati" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-brand-navy">
                <span>Alamat</span>
                <div className="relative"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-brand-navy/30" /><input value={propertyForm.address || ''} onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })} disabled={!isCreating && !canManageProperty} className="w-full rounded-xl border border-brand-navy/10 py-3 pl-10 pr-4 outline-none focus:border-brand-teal disabled:bg-gray-50" placeholder="Alamat properti" /></div>
              </label>
              <label className="space-y-2 text-sm font-semibold text-brand-navy"><span>Zona waktu</span><select value={propertyForm.timezone} onChange={(event) => setPropertyForm({ ...propertyForm, timezone: event.target.value })} disabled={!isCreating && !canManageProperty} className="w-full rounded-xl border border-brand-navy/10 px-4 py-3 disabled:bg-gray-50"><option value="Asia/Jakarta">WIB · Asia/Jakarta</option><option value="Asia/Makassar">WITA · Asia/Makassar</option><option value="Asia/Jayapura">WIT · Asia/Jayapura</option></select></label>
              <label className="space-y-2 text-sm font-semibold text-brand-navy"><span>Mata uang</span><select value={propertyForm.currency} onChange={(event) => setPropertyForm({ ...propertyForm, currency: event.target.value })} disabled={!isCreating && !canManageProperty} className="w-full rounded-xl border border-brand-navy/10 px-4 py-3 disabled:bg-gray-50"><option value="IDR">IDR · Rupiah</option></select></label>
              {(isCreating ? canCreate : canManageProperty) && (
                <div className="flex gap-3 sm:col-span-2">
                  <button type="submit" disabled={isSavingProperty} className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{isSavingProperty && <Loader2 className="h-4 w-4 animate-spin" />}{isCreating ? 'Buat properti' : 'Simpan perubahan'}</button>
                  {isCreating && properties.length > 0 && <button type="button" onClick={() => setIsCreating(false)} className="rounded-xl border border-brand-navy/10 px-5 py-3 text-sm font-bold text-brand-navy">Batal</button>}
                </div>
              )}
            </form>
          </section>

          {!isCreating && activeProperty && canManageMembers && (
            <section className="rounded-[28px] border border-brand-navy/10 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Users className="h-5 w-5" /></div><div><h2 className="font-bold text-brand-navy">Anggota tim</h2><p className="text-xs text-brand-navy/45">Akses hanya berlaku untuk {activeProperty.name}.</p></div></div>
              <form onSubmit={handleAddMember} className="mb-5 grid gap-3 rounded-2xl bg-brand-navy/[0.03] p-4 sm:grid-cols-[1fr_180px_auto]">
                <input type="email" required value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} placeholder="email@contoh.com" className="rounded-xl border border-brand-navy/10 bg-white px-4 py-3 text-sm outline-none focus:border-brand-teal" />
                <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as Exclude<MembershipRole, 'property_owner'>)} className="rounded-xl border border-brand-navy/10 bg-white px-4 py-3 text-sm">{assignableRoles.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}</select>
                <button type="submit" disabled={isSavingMember} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{isSavingMember ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Tambah</button>
              </form>

              {isLoadingMembers ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brand-teal" /></div> : (
                <div className="divide-y divide-brand-navy/5">
                  {members.map((member) => (
                    <div key={getMembershipId(member) || member.user_id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy/50"><Shield className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-brand-navy">{member.name || member.email}</p><p className="truncate text-xs text-brand-navy/45">{member.email}</p></div></div>
                      <div className="flex items-center gap-2">
                        <select value={member.role} disabled={member.role === 'property_owner'} onChange={(event) => void handleRoleChange(member, event.target.value as MembershipRole)} className="rounded-lg border border-brand-navy/10 px-3 py-2 text-xs font-bold disabled:bg-gray-50">{member.role === 'property_owner' && <option value="property_owner">Owner Properti</option>}{assignableRoles.map((role) => <option key={role} value={role}>{getRoleLabel(role)}</option>)}</select>
                        <button type="button" disabled={member.role === 'property_owner'} onClick={() => void handleRemoveMember(member)} aria-label={`Hapus ${member.email}`} className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-20"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  ))}
                  {!members.length && <p className="py-8 text-center text-sm text-brand-navy/45">Belum ada anggota lain.</p>}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
