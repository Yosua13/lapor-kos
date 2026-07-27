'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type TenantProfile = {
  id: string;
  user_id?: string;
  full_name: string;
  status: string;
};

type TenantDocument = {
  id: string;
  document_type: 'ktp' | 'selfie' | 'supporting';
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

type PreviewDocument = {
  name: string;
  mimeType: string;
  url: string;
};

const documentDefinitions = [
  { type: 'ktp' as const, label: 'KTP', description: 'Foto atau pindaian kartu identitas.', required: true },
  { type: 'selfie' as const, label: 'Selfie dengan KTP', description: 'Foto pemegang akun bersama KTP.', required: true },
  { type: 'supporting' as const, label: 'Dokumen tambahan', description: 'Dokumen pendukung bila diperlukan.', required: false },
];

const formatDate = (value: string) => new Date(value).toLocaleDateString('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const formatFileSize = (value: number) => value < 1024 * 1024
  ? `${Math.max(1, Math.round(value / 1024))} KB`
  : `${(value / (1024 * 1024)).toFixed(1)} MB`;

export default function TenantDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const tenantID = params?.id as string;
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingType, setUploadingType] = useState<TenantDocument['document_type'] | null>(null);
  const [openingID, setOpeningID] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDocument | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadDocuments = useCallback(async (profileID: string) => {
    const items = await apiFetch<TenantDocument[]>(`/api/tenant-profiles/${profileID}/documents`);
    setDocuments(items || []);
  }, []);

  const load = useCallback(async () => {
    if (!tenantID) return;
    setLoading(true);
    setError('');
    try {
      const [tenant, profiles] = await Promise.all([
        apiFetch<{ id: string }>('/api/tenants/' + tenantID),
        apiFetch<TenantProfile[]>('/api/tenant-profiles'),
      ]);
      const matchedProfile = (profiles || []).find((item) => item.user_id === tenant.id || item.user_id === tenantID);
      if (!matchedProfile) {
        setProfile(null);
        setDocuments([]);
        setError('Profil tenant untuk properti aktif belum tersedia. Kirim undangan dan aktivasi akun tenant terlebih dahulu.');
        return;
      }
      setProfile(matchedProfile);
      await loadDocuments(matchedProfile.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dokumen tenant tidak dapat dimuat.');
    } finally {
      setLoading(false);
    }
  }, [loadDocuments, tenantID]);

  useEffect(() => {
    void load();
  }, [load]);

  const latestDocuments = useMemo(() => documentDefinitions.reduce<Record<string, TenantDocument | undefined>>((result, definition) => {
    result[definition.type] = documents.find((item) => item.document_type === definition.type);
    return result;
  }, {}), [documents]);

  const uploadDocument = async (type: TenantDocument['document_type'], file: File) => {
    if (!profile) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran dokumen maksimal 5 MB.');
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format dokumen harus PDF, JPG, PNG, atau WEBP.');
      return;
    }

    setUploadingType(type);
    setError('');
    setNotice('');
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('document_type', type);
      await apiFetch(`/api/tenant-profiles/${profile.id}/documents`, { method: 'POST', body: payload });
      await loadDocuments(profile.id);
      setNotice(`${documentDefinitions.find((item) => item.type === type)?.label ?? 'Dokumen'} berhasil disimpan secara privat.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dokumen tidak dapat diunggah.');
    } finally {
      setUploadingType(null);
    }
  };

  const handleFileChange = (type: TenantDocument['document_type']) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void uploadDocument(type, file);
  };

  const openDocument = async (document: TenantDocument) => {
    if (!profile) return;
    setOpeningID(document.id);
    setError('');
    try {
      const signed = await apiFetch<{ url: string }>(`/api/tenant-profiles/${profile.id}/documents/${document.id}/sign`);
      setPreview({ name: document.file_name, mimeType: document.mime_type, url: signed.url });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Akses dokumen tidak dapat dibuat.');
    } finally {
      setOpeningID(null);
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href={`/tenants/${tenantID}`} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-teal hover:text-[#0c7668]">
            <ArrowLeft className="h-4 w-4" /> Kembali ke profil penghuni
          </Link>
          <h1 className="text-2xl font-bold text-brand-navy">Dokumen identitas tenant</h1>
          <p className="mt-1 text-sm text-slate-500">Dokumen tidak pernah ditampilkan sebagai URL permanen. Akses dibuat sementara dan dicatat.</p>
        </div>
        {profile && <span className="inline-flex w-fit items-center gap-2 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700"><ShieldCheck className="h-4 w-4" /> Penyimpanan privat</span>}
      </div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />{notice}</div>}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-teal" /></div>
      ) : profile ? (
        <>
          <div className="grid gap-5 md:grid-cols-3">
            {documentDefinitions.map((definition) => {
              const document = latestDocuments[definition.type];
              const isImage = document?.mime_type.startsWith('image/');
              const isBusy = uploadingType === definition.type;
              return (
                <section key={definition.type} className="flex min-h-80 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-bold text-slate-900">{definition.label}{definition.required && <span className="ml-1 text-red-500">*</span>}</h2><p className="mt-1 text-xs leading-relaxed text-slate-500">{definition.description}</p></div>
                    {document ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">Tersimpan</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">Belum ada</span>}
                  </div>
                  <div className="mt-5 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
                    {isImage ? <ImageIcon className="mb-3 h-9 w-9 text-brand-teal" /> : <FileText className="mb-3 h-9 w-9 text-slate-400" />}
                    {document ? <><p className="max-w-full truncate text-sm font-semibold text-slate-800">{document.file_name}</p><p className="mt-1 text-xs text-slate-500">{formatFileSize(document.size_bytes)} · {formatDate(document.created_at)}</p></> : <p className="text-sm text-slate-500">Belum ada dokumen.</p>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={!document || openingID === document.id} onClick={() => document && void openDocument(document)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45">{openingID === document?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Lihat</button>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-brand-teal px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0c7668]">{isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{document ? 'Ganti' : 'Unggah'}<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFileChange(definition.type)} disabled={isBusy} /></label>
                  </div>
                </section>
              );
            })}
          </div>
          <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-sm text-teal-900"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-teal" /><div><p className="font-bold">Akses dokumen terkontrol</p><p className="mt-1 leading-relaxed text-teal-800">Tombol Lihat meminta URL bertanda tangan dengan masa berlaku singkat. Permintaan akses hanya dilayani setelah otorisasi properti dan direkam pada audit log.</p></div></div></div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><FileText className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-bold text-slate-900">Profil tenant belum tersedia</h2><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Dokumen dapat dikelola setelah tenant menerima undangan dan profilnya aktif pada properti ini.</p><button type="button" onClick={() => router.push('/tenants/invitations')} className="mt-5 rounded-lg bg-brand-teal px-4 py-2 text-sm font-bold text-white hover:bg-[#0c7668]">Buka undangan tenant</button></div>
      )}

      {preview && <div role="dialog" aria-modal="true" aria-label={`Pratinjau ${preview.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="min-w-0"><p className="truncate font-bold text-slate-900">{preview.name}</p><p className="text-xs text-slate-500">URL akses sementara</p></div><button type="button" onClick={() => setPreview(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Tutup pratinjau"><X className="h-5 w-5" /></button></div><div className="min-h-0 flex-1 bg-slate-100 p-3">{preview.mimeType.startsWith('image/') ? <img src={preview.url} alt={preview.name} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" /> : <iframe title={preview.name} src={preview.url} className="h-[72vh] w-full rounded-lg border-0 bg-white" />}</div></div></div>}
    </main>
  );
}
