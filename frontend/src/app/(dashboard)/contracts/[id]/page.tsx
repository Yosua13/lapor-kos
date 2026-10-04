'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, Download, FilePlus2, FileText, History, Home, Loader2, PenLine, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { apiBlob, apiFetch } from '@/lib/api';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { ContractDetail, ContractStatus, ownerTransitions, STATUS_LABELS } from '@/features/contracts/types';

type Dialog = null | { kind: 'transition'; target: ContractStatus } | { kind: 'amend' } | { kind: 'renew' };

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value || 0);
const date = (value?: string) => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const statusTone: Record<ContractStatus, string> = {
  draft: 'bg-slate-100 text-slate-700', pending_tenant: 'bg-amber-100 text-amber-800', scheduled: 'bg-sky-100 text-sky-800',
  active: 'bg-emerald-100 text-emerald-800', ended: 'bg-slate-200 text-slate-700', terminated: 'bg-rose-100 text-rose-800',
  renewed: 'bg-violet-100 text-violet-800', cancelled: 'bg-rose-100 text-rose-800',
};

export default function ContractLifecyclePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can, isTenant } = useAuthorization();
  const canWrite = can(CAPABILITIES.CONTRACT_WRITE);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    setLoading(true); setError('');
    try {
      const endpoint = isTenant ? `/api/contracts/${params.id}/review` : `/api/contracts/${params.id}`;
      setContract(await apiFetch<ContractDetail>(endpoint, { propertyScoped: !isTenant }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kontrak tidak dapat dimuat.');
    } finally { setLoading(false); }
  }, [isTenant, params.id]);

  // Loading is the external synchronization performed by this effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const transitions = useMemo(() => contract ? ownerTransitions(contract.status) : [], [contract]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setDialog(null); setNotice(success); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Operasi kontrak gagal.'); }
    finally { setBusy(false); }
  };

  const accept = () => run(
    () => apiFetch(`/api/contracts/${params.id}/accept`, { method: 'POST', propertyScoped: false, body: JSON.stringify({ policy_accepted: policyAccepted }) }),
    'Persetujuan tersimpan. Kontrak sekarang menunggu aktivasi pengelola.',
  );

  const publish = () => run(
    () => apiFetch(`/api/contracts/${params.id}/documents`, { method: 'POST' }),
    'PDF immutable untuk versi aktif berhasil diterbitkan.',
  );

  const download = async (documentID: string, fileName: string) => {
    setError('');
    try {
      const endpoint = isTenant ? `/api/contracts/${params.id}/review/documents/${documentID}` : `/api/contracts/${params.id}/documents/${documentID}`;
      const blob = await apiBlob(endpoint, { propertyScoped: !isTenant });
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = fileName; anchor.click(); URL.revokeObjectURL(url);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Dokumen gagal diunduh.'); }
  };

  if (loading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-brand-teal" /></div>;
  if (!contract) return <div className="mx-auto max-w-4xl space-y-4"><Message kind="error">{error || 'Kontrak tidak ditemukan.'}</Message><button onClick={() => router.back()} className="font-semibold text-brand-teal">Kembali</button></div>;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <button type="button" onClick={() => router.back()} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-teal"><ArrowLeft className="h-4 w-4" /> Kembali</button>
          <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold text-brand-navy lg:text-3xl">Lifecycle kontrak</h1><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusTone[contract.status]}`}>{STATUS_LABELS[contract.status]}</span></div>
          <p className="mt-2 break-all text-sm text-slate-500">ID {contract.id}</p>
        </div>
        {canWrite && <div className="flex flex-wrap gap-2">
          {(contract.status === 'draft' || contract.status === 'pending_tenant' || contract.status === 'scheduled' || contract.status === 'active') && <button onClick={() => setDialog({ kind: 'amend' })} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-brand-teal hover:text-brand-teal"><PenLine className="h-4 w-4" /> Amendment</button>}
          {contract.status === 'active' && <button onClick={() => setDialog({ kind: 'renew' })} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100"><RefreshCw className="h-4 w-4" /> Renewal</button>}
          <button onClick={publish} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"><FilePlus2 className="h-4 w-4" /> Terbitkan PDF</button>
        </div>}
      </div>

      {error && <Message kind="error">{error}</Message>}
      {notice && <Message kind="success">{notice}</Message>}

      {isTenant && contract.status === 'pending_tenant' && <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-bold text-teal-950">Persetujuan tenant diperlukan</h2><p className="mt-1 text-sm text-teal-800">Tinjau tanggal, harga, dan ketentuan kontrak. Persetujuan direkam untuk versi {contract.versions[0]?.version_number}.</p><label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-teal-200 bg-white/70 p-3 text-sm font-semibold text-teal-950"><input type="checkbox" checked={policyAccepted} onChange={event => setPolicyAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 accent-teal-600" /><span>Saya menyetujui snapshot kontrak dan aturan properti yang berlaku.</span></label></div><button onClick={accept} disabled={busy || !policyAccepted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Setujui kontrak</button></div>
      </section>}

      {canWrite && transitions.length > 0 && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-widest text-slate-400">Aksi status yang tersedia</p><div className="mt-3 flex flex-wrap gap-2">{transitions.map(target => <button key={target} onClick={() => setDialog({ kind: 'transition', target })} className="rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0c7668]">Ubah ke {STATUS_LABELS[target]}</button>)}</div></section>}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-brand-teal"><FileText className="h-5 w-5" /></div><div><h2 className="font-bold text-brand-navy">Snapshot kontrak saat ini</h2><p className="text-xs text-slate-500">Versi {contract.versions[0]?.version_number ?? '-'}</p></div></div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Datum label="Tenant" value={contract.user?.name || contract.user_id} /><Datum label="Kamar" value={contract.room?.room_number || contract.room_id} />
            <Datum label="Mulai" value={date(contract.start_date)} /><Datum label="Berakhir" value={date(contract.end_date)} />
            <Datum label="Sewa bulanan" value={money(contract.monthly_rent)} /><Datum label="Deposit" value={money(contract.deposit)} />
            <Datum label="Total snapshot" value={money(contract.total_price)} /><Datum label="Jatuh tempo" value={`Tanggal ${contract.payment_due_day}`} />
          </dl>
          <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Catatan</p><p className="mt-2 text-sm text-slate-700">{contract.notes || 'Tidak ada catatan.'}</p></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-6">
          <div className="mb-5 flex items-center gap-3"><div className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><History className="h-5 w-5" /></div><div><h2 className="font-bold text-brand-navy">Audit trail</h2><p className="text-xs text-slate-500">Append-only dan property-scoped</p></div></div>
          <div className="max-h-[430px] space-y-4 overflow-auto pr-1">{contract.events.map(event => <div key={event.id} className="relative border-l-2 border-slate-200 pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-brand-teal" /><p className="text-sm font-bold text-slate-800">{event.event_type.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">{event.from_status && event.to_status ? `${event.from_status} → ${event.to_status} · ` : ''}{date(event.created_at)}</p><p className="mt-1 text-sm text-slate-600">{event.reason || '-'}</p></div>)}{contract.events.length === 0 && <Empty text="Belum ada event lifecycle." />}</div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-brand-navy"><Home className="h-5 w-5 text-brand-teal" /> Riwayat occupancy</h2><div className="mt-4 space-y-3">{contract.occupancy_periods.map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-4"><div><p className="text-sm font-bold text-slate-800">{date(item.start_date)} – {date(item.end_date)}</p><p className="mt-1 text-xs text-slate-500">{item.closed_at ? `Ditutup ${date(item.closed_at)}` : 'Periode aktif'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.closed_at ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{item.closed_at ? 'Closed' : 'Open'}</span></div>)}{contract.occupancy_periods.length === 0 && <Empty text="Occupancy dibuat ketika kontrak diaktifkan." />}</div></section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold text-brand-navy"><FileText className="h-5 w-5 text-brand-teal" /> Dokumen terbit</h2><div className="mt-4 space-y-3">{contract.documents.map(item => <div key={item.id} className="rounded-xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{item.file_name}</p><p className="mt-1 text-xs text-slate-500">Versi {item.version_number} · {date(item.published_at)}</p></div><button onClick={() => download(item.id, item.file_name)} className="rounded-lg p-2 text-brand-teal hover:bg-teal-50" aria-label="Unduh PDF"><Download className="h-4 w-4" /></button></div><p className="mt-3 break-all font-mono text-[10px] text-slate-400">SHA-256 {item.sha256}</p></div>)}{contract.documents.length === 0 && <Empty text="Belum ada PDF yang diterbitkan." />}</div></section>
      </div>

      {dialog && <ContractDialog contract={contract} dialog={dialog} busy={busy} onClose={() => !busy && setDialog(null)} onSubmit={(payload) => {
        if (dialog.kind === 'transition') return run(() => apiFetch(`/api/contracts/${contract.id}/transitions`, { method: 'POST', body: JSON.stringify({ ...payload, to_status: dialog.target }) }), `Status berubah menjadi ${STATUS_LABELS[dialog.target]}.`);
        if (dialog.kind === 'amend') return run(() => apiFetch(`/api/contracts/${contract.id}/amendments`, { method: 'POST', body: JSON.stringify(payload) }), 'Amendment tersimpan sebagai versi baru.');
        return run(() => apiFetch(`/api/contracts/${contract.id}/renewals`, { method: 'POST', body: JSON.stringify(payload) }), 'Draft renewal berhasil dibuat tanpa menimpa kontrak lama.');
      }} />}
    </div>
  );
}

function Datum({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{text}</div>; }
function Message({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) { const Icon = kind === 'error' ? AlertCircle : CheckCircle2; return <div role={kind === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" />{children}</div>; }

function ContractDialog({ contract, dialog, busy, onClose, onSubmit }: { contract: ContractDetail; dialog: Exclude<Dialog, null>; busy: boolean; onClose: () => void; onSubmit: (payload: Record<string, unknown>) => Promise<void> }) {
  const renewalStart = new Date(contract.end_date); renewalStart.setUTCDate(renewalStart.getUTCDate() + 1);
  const renewalEnd = new Date(renewalStart); renewalEnd.setUTCMonth(renewalEnd.getUTCMonth() + Math.max(1, contract.rental_duration));
  const [reason, setReason] = useState(''); const [startDate, setStartDate] = useState(dialog.kind === 'renew' ? renewalStart.toISOString().slice(0, 10) : contract.start_date.slice(0, 10)); const [endDate, setEndDate] = useState(dialog.kind === 'renew' ? renewalEnd.toISOString().slice(0, 10) : contract.end_date.slice(0, 10)); const [rent, setRent] = useState(String(contract.monthly_rent)); const [deposit, setDeposit] = useState(String(contract.deposit)); const [notes, setNotes] = useState(contract.notes || ''); const [fieldError, setFieldError] = useState('');
  const title = dialog.kind === 'transition' ? `Ubah status ke ${STATUS_LABELS[dialog.target]}` : dialog.kind === 'amend' ? 'Buat amendment' : 'Buat draft renewal';
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!reason.trim()) { setFieldError('Alasan wajib diisi untuk audit trail.'); return; } const payload: Record<string, unknown> = { reason: reason.trim() }; if (dialog.kind !== 'transition') Object.assign(payload, { start_date: startDate, end_date: endDate, monthly_rent: Number(rent), deposit: Number(deposit), payment_interval: contract.payment_interval, payment_due_day: contract.payment_due_day, notes }); if (dialog.kind === 'transition' && (dialog.target === 'ended' || dialog.target === 'terminated')) payload.effective_date = new Date().toISOString().slice(0, 10); await onSubmit(payload); };
  const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-teal focus:ring-4 focus:ring-teal-50 disabled:bg-slate-100 disabled:text-slate-500';
  return <div role="dialog" aria-modal="true" aria-labelledby="contract-dialog-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 id="contract-dialog-title" className="text-xl font-extrabold text-brand-navy">{title}</h2><p className="mt-1 text-sm text-slate-500">Perubahan dicatat sebagai histori yang dapat diaudit.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Tutup"><X className="h-5 w-5" /></button></div>
    {dialog.kind !== 'transition' && <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Tanggal mulai"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required disabled={dialog.kind === 'amend' && contract.status === 'active'} className={inputClass} /></Field><Field label="Tanggal berakhir"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required className={inputClass} /></Field><Field label="Sewa bulanan"><input type="number" min="1" value={rent} onChange={e => setRent(e.target.value)} required className={inputClass} /></Field><Field label="Deposit"><input type="number" min="0" value={deposit} onChange={e => setDeposit(e.target.value)} required className={inputClass} /></Field><div className="sm:col-span-2"><Field label="Catatan"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className={`${inputClass} resize-none`} /></Field></div></div>}
    <div className="mt-5"><Field label="Alasan"><textarea value={reason} onChange={e => { setReason(e.target.value); setFieldError(''); }} rows={3} className={`${inputClass} resize-none ${fieldError ? 'border-red-400' : ''}`} placeholder="Jelaskan alasan perubahan" />{fieldError && <span className="mt-1 block text-xs font-semibold text-red-600">{fieldError}</span>}</Field></div>
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700">Batal</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />} Simpan</button></div>
  </form></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-700"><span className="mb-1.5 block">{label}</span>{children}</label>; }
