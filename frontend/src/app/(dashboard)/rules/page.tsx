'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Printer,
  Shield,
  Trash2,
  Zap,
  CreditCard,
  Info,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  AlertCircle,
  History,
  Clock,
  Sparkles,
  Users,
  Check,
  Send,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import { useAuthorization } from '@/features/authorization/useAuthorization';
import { CAPABILITIES } from '@/features/authorization/permissions';
import type {
  RuleCategory,
  RuleItem,
  RuleSeverity,
  RuleTemplateItem,
  RuleVersion,
  RuleAcknowledgment,
  ActiveRulesResponse,
} from '@/features/rules/types';
import {
  fetchActiveRules,
  fetchRuleTemplates,
  fetchRuleVersions,
  fetchRuleVersion,
  saveDraftRules,
  publishRuleVersion,
  acknowledgeRules,
  fetchRuleAcknowledgments,
} from '@/features/rules/api';
import {
  getCategoryLabel,
  getCategoryColor,
  getSeverityBadge,
  getVersionStatusBadge,
  formatDate,
  CATEGORY_LABELS,
} from '@/features/rules/format';

type CategoryFilter = 'semua' | RuleCategory;

const categoryIcons: Record<RuleCategory, React.ComponentType<{ className?: string }>> = {
  keamanan: Shield,
  kebersihan: Trash2,
  fasilitas: Zap,
  pembayaran: CreditCard,
  ketertiban: Users,
  tamu: Users,
  umum: Info,
};

export default function HouseRulesPage() {
  const { can, isTenant } = useAuthorization();
  const canWrite = can(CAPABILITIES.RULE_WRITE);

  // Active rules & acknowledgment state
  const [activeData, setActiveData] = useState<ActiveRulesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('semua');
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});

  // Tenant acknowledgment action states
  const [consentChecked, setConsentChecked] = useState(false);
  const [isSubmittingAck, setIsSubmittingAck] = useState(false);
  const [ackNotice, setAckNotice] = useState<string | null>(null);

  // Modals state
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);

  // Version history & audit states
  const [versionsList, setVersionsList] = useState<RuleVersion[]>([]);
  const [selectedVersionForInspect, setSelectedVersionForInspect] = useState<RuleVersion | null>(null);
  const [acknowledgmentsList, setAcknowledgmentsList] = useState<RuleAcknowledgment[]>([]);
  const [auditVersionNumber, setAuditVersionNumber] = useState<number>(1);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Draft Editor Form State
  const [draftTitle, setDraftTitle] = useState('Peraturan Tata Tertib Kos');
  const [draftDescription, setDraftDescription] = useState('Peraturan resmi dan tata tertib penghuni');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftItems, setDraftItems] = useState<
    Array<{
      category: RuleCategory;
      title: string;
      description: string;
      details: string[];
      severity: RuleSeverity;
      order_index: number;
      penalty_description?: string;
    }>
  >([]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Publish Form State
  const [publishEffectiveDate, setPublishEffectiveDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [publishChangeSummary, setPublishChangeSummary] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Load active data
  const loadActiveRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchActiveRules();
      setActiveData(data);
      if (data.version) {
        // Expand first two rules by default
        const initialExpanded: Record<string, boolean> = {};
        data.version.items.slice(0, 2).forEach((item) => {
          initialExpanded[item.id] = true;
        });
        setExpandedRules(initialExpanded);
      }
    } catch (err) {
      console.error('Error fetching active rules:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActiveRules();
  }, [loadActiveRules]);

  // Handle Tenant Acknowledgment
  const handleAcknowledge = async () => {
    if (!activeData?.version?.id || !consentChecked) return;
    setIsSubmittingAck(true);
    setAckNotice(null);
    try {
      const consentText = `Saya telah membaca, memahami, dan menyetujui seluruh isi Peraturan Tata Tertib Kos Versi ${activeData.version.version_number}.`;
      await acknowledgeRules({
        rule_version_id: activeData.version.id,
        consent_text: consentText,
      });
      setAckNotice(`Persetujuan Peraturan Versi ${activeData.version.version_number} berhasil dicatat.`);
      setConsentChecked(false);
      await loadActiveRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mencatat persetujuan peraturan.';
      alert(msg);
    } finally {
      setIsSubmittingAck(false);
    }
  };

  // Open Draft Editor
  const handleOpenDraftEditor = async () => {
    setDraftError(null);
    setIsSavingDraft(false);

    try {
      // Check if draft version already exists in version list
      const versions = await fetchRuleVersions();
      const draft = versions.find((v) => v.status === 'draft');

      if (draft) {
        const fullDraft = await fetchRuleVersion(draft.id);
        setDraftTitle(activeData?.rule_set?.title || 'Peraturan Tata Tertib Kos');
        setDraftDescription(activeData?.rule_set?.description || 'Peraturan resmi dan tata tertib penghuni');
        setDraftSummary(fullDraft.change_summary || '');
        setDraftItems(
          fullDraft.items.map((it, idx) => ({
            category: it.category,
            title: it.title,
            description: it.description,
            details: it.details.length > 0 ? [...it.details] : [''],
            severity: it.severity || 'standard',
            order_index: it.order_index || idx + 1,
            penalty_description: it.penalty_description || '',
          })),
        );
      } else if (activeData?.version) {
        // Base draft on current published version
        setDraftTitle(activeData.rule_set?.title || 'Peraturan Tata Tertib Kos');
        setDraftDescription(activeData.rule_set?.description || 'Peraturan resmi dan tata tertib penghuni');
        setDraftSummary(`Pembaruan dari Versi ${activeData.version.version_number}`);
        setDraftItems(
          activeData.version.items.map((it, idx) => ({
            category: it.category,
            title: it.title,
            description: it.description,
            details: it.details.length > 0 ? [...it.details] : [''],
            severity: it.severity || 'standard',
            order_index: it.order_index || idx + 1,
            penalty_description: it.penalty_description || '',
          })),
        );
      } else {
        // Brand new draft
        setDraftTitle('Peraturan Tata Tertib Kos');
        setDraftDescription('Peraturan resmi tata tertib hunian kos');
        setDraftSummary('Inisialisasi peraturan kos');
        setDraftItems([]);
      }
    } catch (err) {
      console.error('Failed to prepare draft editor:', err);
    }

    setIsDraftModalOpen(true);
  };

  // Load from template (AC 1: purely in-memory prefill, no database mutation)
  const handleLoadFromTemplate = async () => {
    try {
      const templates = await fetchRuleTemplates();
      if (!templates || templates.length === 0) return;

      const newItems = templates.map((tmpl, idx) => ({
        category: tmpl.category,
        title: tmpl.title,
        description: tmpl.description,
        details: [...tmpl.details],
        severity: tmpl.severity,
        order_index: idx + 1,
        penalty_description: '',
      }));

      setDraftItems(newItems);
      setDraftError(null);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setDraftError('Gagal memuat template standar.');
    }
  };

  // Save Draft Submission
  const handleSaveDraft = async () => {
    setDraftError(null);
    if (draftItems.length === 0) {
      setDraftError('Peraturan harus memiliki minimal 1 butir aturan.');
      return;
    }

    setIsSavingDraft(true);
    try {
      await saveDraftRules({
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        change_summary: draftSummary.trim(),
        items: draftItems.map((item, idx) => ({
          ...item,
          order_index: idx + 1,
          details: item.details.map((d) => d.trim()).filter((d) => d !== ''),
        })),
      });

      setIsDraftModalOpen(false);
      await loadActiveRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan draft peraturan.';
      setDraftError(msg);
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Open Publish Modal
  const handleOpenPublish = () => {
    setPublishError(null);
    setPublishEffectiveDate(new Date().toISOString().slice(0, 10));
    setPublishChangeSummary(draftSummary || 'Pembaruan versi peraturan kos resmi.');
    setIsPublishModalOpen(true);
  };

  // Execute Publish
  const handleExecutePublish = async () => {
    setIsPublishing(true);
    setPublishError(null);
    try {
      // First save draft to ensure latest edits are saved
      const savedDraft = await saveDraftRules({
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        change_summary: publishChangeSummary.trim(),
        items: draftItems.map((item, idx) => ({
          ...item,
          order_index: idx + 1,
          details: item.details.map((d) => d.trim()).filter((d) => d !== ''),
        })),
      });

      // Then publish the draft version
      await publishRuleVersion(savedDraft.id, {
        effective_from: publishEffectiveDate ? new Date(publishEffectiveDate).toISOString() : undefined,
        change_summary: publishChangeSummary.trim(),
      });

      setIsPublishModalOpen(false);
      setIsDraftModalOpen(false);
      await loadActiveRules();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menerbitkan versi peraturan.';
      setPublishError(msg);
    } finally {
      setIsPublishing(false);
    }
  };

  // Open Version History Modal
  const handleOpenHistory = async () => {
    setIsLoadingHistory(true);
    setIsHistoryModalOpen(true);
    try {
      const list = await fetchRuleVersions();
      setVersionsList(list);
    } catch (err) {
      console.error('Failed to load version history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Inspect specific historical version
  const handleInspectVersion = async (v: RuleVersion) => {
    try {
      const detailed = await fetchRuleVersion(v.id);
      setSelectedVersionForInspect(detailed);
      setIsInspectModalOpen(true);
    } catch (err) {
      console.error('Failed to load version details:', err);
    }
  };

  // Open Audit Modal
  const handleOpenAudit = async (versionID: string, verNum: number) => {
    setAuditVersionNumber(verNum);
    setIsLoadingAudit(true);
    setIsAuditModalOpen(true);
    try {
      const acks = await fetchRuleAcknowledgments(versionID);
      setAcknowledgmentsList(acks);
    } catch (err) {
      console.error('Failed to load acknowledgments audit:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  // Filter rules based on search and category
  const filteredItems = useMemo(() => {
    if (!activeData?.version?.items) return [];
    return activeData.version.items.filter((rule) => {
      const matchesCategory = selectedCategory === 'semua' || rule.category === selectedCategory;
      const matchesSearch =
        rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.details.some((d) => d.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [activeData?.version?.items, selectedCategory, searchQuery]);

  const toggleAccordion = (id: string) => {
    setExpandedRules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    if (!activeData?.version?.items) return;
    const allExpanded: Record<string, boolean> = {};
    activeData.version.items.forEach((r) => {
      allExpanded[r.id] = true;
    });
    setExpandedRules(allExpanded);
  };

  const collapseAll = () => {
    setExpandedRules({});
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#0e8a7a]" />
        <p className="text-sm font-semibold text-slate-500">Memuat peraturan tata tertib...</p>
      </div>
    );
  }

  const currentVersion = activeData?.version;
  const isAcknowledged = activeData?.acknowledged;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 lg:text-3xl">
              {activeData?.rule_set?.title || 'Peraturan Tata Tertib Kos'}
            </h1>
            {currentVersion && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                  getVersionStatusBadge(currentVersion.status).color
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                Versi {currentVersion.version_number} · {getVersionStatusBadge(currentVersion.status).label}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {activeData?.rule_set?.description ||
              'Dokumen versioned tata tertib resmi dengan tanggal berlaku dan pencatatan persetujuan tenant.'}
          </p>
          {currentVersion && (
            <p className="mt-1 text-xs text-slate-400">
              Berlaku sejak: {formatDate(currentVersion.effective_from || currentVersion.published_at)} · Total{' '}
              {currentVersion.total_items} butir aturan
              {currentVersion.change_summary ? ` · "${currentVersion.change_summary}"` : ''}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" /> Cetak
          </button>

          {canWrite && (
            <>
              <button
                onClick={handleOpenHistory}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-800 transition hover:bg-violet-100"
              >
                <History className="h-4 w-4" /> Histori Versi
              </button>

              {currentVersion && (
                <button
                  onClick={() => handleOpenAudit(currentVersion.id, currentVersion.version_number)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                >
                  <Users className="h-4 w-4" /> Audit Persetujuan
                </button>
              )}

              <button
                onClick={handleOpenDraftEditor}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e8a7a] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c7668]"
              >
                <Plus className="h-4 w-4" /> Edit Draft / Versi Baru
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notice Message */}
      {ackNotice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span>{ackNotice}</span>
        </div>
      )}

      {/* Tenant Acknowledgment Banner */}
      {isTenant && currentVersion && (
        <section
          className={`rounded-2xl border p-5 shadow-sm transition ${
            isAcknowledged
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
              : 'border-amber-300 bg-amber-50/90 text-amber-950'
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`rounded-xl p-2.5 ${
                  isAcknowledged ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                {isAcknowledged ? <CheckCircle2 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-base font-extrabold">
                  {isAcknowledged
                    ? `Peraturan Kos Versi ${currentVersion.version_number} Telah Disetujui`
                    : `Persetujuan Peraturan Versi ${currentVersion.version_number} Diperlukan`}
                </h2>
                <p className="mt-1 text-xs text-slate-700">
                  {isAcknowledged
                    ? `Anda telah menyetujui seluruh ketentuan ini pada ${formatDate(
                        activeData?.acknowledgment?.acknowledged_at,
                      )}. Bukti tersimpan resmi di sistem audit.`
                    : 'Sebagai tenant resmi, Anda diwajibkan membaca dan memberikan persetujuan terhadap versi aktif peraturan hunian ini.'}
                </p>
                {isAcknowledged && activeData?.acknowledgment?.consent_text && (
                  <p className="mt-2 text-xs italic text-slate-500">
                    &quot;{activeData.acknowledgment.consent_text}&quot;
                  </p>
                )}
              </div>
            </div>

            {!isAcknowledged && (
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-300 bg-white/80 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-sm">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="h-4 w-4 accent-[#0e8a7a]"
                  />
                  <span>Saya memahami & menyetujui Versi {currentVersion.version_number}</span>
                </label>
                <button
                  onClick={handleAcknowledge}
                  disabled={!consentChecked || isSubmittingAck}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0e8a7a] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c7668] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmittingAck ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Konfirmasi Persetujuan
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Search & Category Filter Bar */}
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kata kunci peraturan (misal: gerbang, sampah, ac, denda)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none transition focus:border-[#0e8a7a] focus:bg-white focus:ring-4 focus:ring-teal-50"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <button
              onClick={expandAll}
              className="rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Buka Semua
            </button>
            <span>·</span>
            <button
              onClick={collapseAll}
              className="rounded-lg px-2.5 py-1.5 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Tutup Semua
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5 pt-2">
          <button
            onClick={() => setSelectedCategory('semua')}
            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              selectedCategory === 'semua'
                ? 'bg-[#0e8a7a] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Kategori
          </button>
          {(Object.keys(CATEGORY_LABELS) as RuleCategory[]).map((cat) => {
            const Icon = categoryIcons[cat];
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  isSelected
                    ? 'bg-[#0e8a7a] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rules Content Display */}
      {!currentVersion || currentVersion.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <ShieldAlert className="mx-auto h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-base font-extrabold text-slate-800">Belum Ada Peraturan Diterbitkan</h2>
          <p className="mx-auto mt-2 max-w-md text-xs text-slate-500">
            {canWrite
              ? 'Membaca peraturan tidak akan membuat data dummy otomatis. Silakan klik tombol di bawah untuk membuat draft atau memuat dari template standar.'
              : 'Pengelola belum menerbitkan peraturan resmi untuk kos ini. Silakan hubungi pengelola.'}
          </p>
          {canWrite && (
            <button
              onClick={handleOpenDraftEditor}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0e8a7a] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c7668]"
            >
              <Sparkles className="h-4 w-4" /> Buka Draft Editor
            </button>
          )}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-600">Tidak ada aturan yang cocok dengan pencarian Anda.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('semua');
            }}
            className="mt-3 text-xs font-bold text-[#0e8a7a] hover:underline"
          >
            Reset filter pencarian
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredItems.map((rule, index) => {
            const isExpanded = !!expandedRules[rule.id];
            const Icon = categoryIcons[rule.category] || Info;
            const categoryBadgeClass = getCategoryColor(rule.category);
            const severityBadge = getSeverityBadge(rule.severity);

            return (
              <div
                key={rule.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Rule Item Header */}
                <div
                  onClick={() => toggleAccordion(rule.id)}
                  className="flex cursor-pointer items-start justify-between gap-4 p-5 transition hover:bg-slate-50/60"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-extrabold text-slate-600">
                      {rule.order_index || index + 1}
                    </span>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${categoryBadgeClass}`}
                        >
                          <Icon className="h-3 w-3" />
                          {getCategoryLabel(rule.category)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${severityBadge.color}`}
                        >
                          {severityBadge.label}
                        </span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900">{rule.title}</h3>
                      <p className="text-xs text-slate-600">{rule.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/50 hover:text-slate-600"
                    aria-label={isExpanded ? 'Tutup rincian' : 'Buka rincian'}
                  >
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-4">
                    {rule.details && rule.details.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Ketentuan & Petunjuk Pelaksanaan
                        </p>
                        <ul className="mt-2.5 space-y-2">
                          {rule.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-2.5 text-xs font-medium text-slate-700">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0e8a7a]" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {rule.penalty_description && (
                      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 p-3 text-xs text-red-900">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <div>
                          <span className="font-bold">Konsekuensi Pelanggaran: </span>
                          <span>{rule.penalty_description}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* Draft Editor Modal (Owner/Manager) */}
      {/* ========================================================================= */}
      {isDraftModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Editor Draft Peraturan Kos</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Perubahan disimpan sebagai draft terpisah dan tidak akan menggantikan versi aktif sebelum diterbitkan.
                </p>
              </div>
              <button
                onClick={() => setIsDraftModalOpen(false)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {draftError && (
                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{draftError}</span>
                </div>
              )}

              {/* Title & Summary */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Judul Dokumen Peraturan</label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium outline-none focus:border-[#0e8a7a] focus:ring-4 focus:ring-teal-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">Ringkasan Perubahan (Change Log)</label>
                  <input
                    type="text"
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    placeholder="Misal: Penyesuaian jam malam dan penambahan aturan tamu"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium outline-none focus:border-[#0e8a7a] focus:ring-4 focus:ring-teal-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700">Deskripsi Tata Tertib</label>
                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    rows={2}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#0e8a7a] focus:ring-4 focus:ring-teal-50"
                  />
                </div>
              </div>

              {/* Item List Header & Template Action */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100 pt-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Daftar Butir Peraturan ({draftItems.length})
                  </h3>
                  <p className="text-xs text-slate-500">Kelola rincian aturan per kategori</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadFromTemplate}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-1.5 text-xs font-bold text-teal-800 transition hover:bg-teal-100"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Muat dari Template
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftItems((prev) => [
                        ...prev,
                        {
                          category: 'umum',
                          title: '',
                          description: '',
                          details: [''],
                          severity: 'standard',
                          order_index: prev.length + 1,
                          penalty_description: '',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Butir
                  </button>
                </div>
              </div>

              {/* Rule Items Editor */}
              <div className="space-y-4">
                {draftItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 transition hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                      <span className="font-mono text-xs font-bold text-slate-500">Butir #{index + 1}</span>
                      <button
                        type="button"
                        onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== index))}
                        className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Hapus butir ini"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600">Kategori</label>
                        <select
                          value={item.category}
                          onChange={(e) => {
                            const val = e.target.value as RuleCategory;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === index ? { ...it, category: val } : it)),
                            );
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[#0e8a7a]"
                        >
                          {(Object.keys(CATEGORY_LABELS) as RuleCategory[]).map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_LABELS[c]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600">Judul Aturan</label>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === index ? { ...it, title: val } : it)),
                            );
                          }}
                          placeholder="Misal: Akses & Jam Malam Gerbang"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-[#0e8a7a]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">Deskripsi Singkat</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftItems((prev) =>
                            prev.map((it, i) => (i === index ? { ...it, description: val } : it)),
                          );
                        }}
                        rows={2}
                        placeholder="Penjelasan umum aturan ini"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium outline-none focus:border-[#0e8a7a]"
                      />
                    </div>

                    {/* Details Rows */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-600">Rincian Butir (Poin-poin)</label>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === index ? { ...it, details: [...it.details, ''] } : it)),
                            );
                          }}
                          className="text-[11px] font-bold text-[#0e8a7a] hover:underline"
                        >
                          + Tambah Poin
                        </button>
                      </div>
                      <div className="mt-1.5 space-y-1.5">
                        {item.details.map((detail, dIdx) => (
                          <div key={dIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={detail}
                              onChange={(e) => {
                                const val = e.target.value;
                                setDraftItems((prev) =>
                                  prev.map((it, i) => {
                                    if (i !== index) return it;
                                    const nextDetails = [...it.details];
                                    nextDetails[dIdx] = val;
                                    return { ...it, details: nextDetails };
                                  }),
                                );
                              }}
                              placeholder={`Poin ${dIdx + 1}`}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#0e8a7a]"
                            />
                            {item.details.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDraftItems((prev) =>
                                    prev.map((it, i) => {
                                      if (i !== index) return it;
                                      return {
                                        ...it,
                                        details: it.details.filter((_, idx) => idx !== dIdx),
                                      };
                                    }),
                                  );
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-red-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600">Tingkat Kepentingan</label>
                        <select
                          value={item.severity}
                          onChange={(e) => {
                            const val = e.target.value as RuleSeverity;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === index ? { ...it, severity: val } : it)),
                            );
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[#0e8a7a]"
                        >
                          <option value="standard">Standar</option>
                          <option value="major">Penting</option>
                          <option value="critical">Kritis</option>
                          <option value="minor">Ringan</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600">Sanksi / Konsekuensi (Opsional)</label>
                        <input
                          type="text"
                          value={item.penalty_description || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDraftItems((prev) =>
                              prev.map((it, i) => (i === index ? { ...it, penalty_description: val } : it)),
                            );
                          }}
                          placeholder="Misal: Denda Rp 50.000 atau teguran tertulis"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-[#0e8a7a]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 p-6">
              <button
                type="button"
                onClick={() => setIsDraftModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60"
              >
                Tutup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isSavingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                  Simpan Draft Saja
                </button>
                <button
                  type="button"
                  onClick={handleOpenPublish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#0e8a7a] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c7668]"
                >
                  <Send className="h-4 w-4" /> Lanjut Terbitkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Publish Version Modal (AC 2) */}
      {/* ========================================================================= */}
      {isPublishModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Terbitkan Versi Peraturan</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Setelah diterbitkan, dokumen ini menjadi versi aktif dan berstatus IMMUTABLE.
                </p>
              </div>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {publishError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
                {publishError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700">Tanggal Mulai Berlaku</label>
                <input
                  type="date"
                  value={publishEffectiveDate}
                  onChange={(e) => setPublishEffectiveDate(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-medium outline-none focus:border-[#0e8a7a]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Catatan Perubahan Versi</label>
                <textarea
                  value={publishChangeSummary}
                  onChange={(e) => setPublishChangeSummary(e.target.value)}
                  rows={3}
                  required
                  placeholder="Jelaskan ringkasan perubahan untuk dicatat pada histori versi..."
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium outline-none focus:border-[#0e8a7a]"
                />
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Jaminan Immutability & Notifikasi</span>
                </div>
                <p>
                  1. Versi yang diterbitkan tidak dapat diubah kembali untuk menjamin keabsahan hukum kontrak.
                </p>
                <p>
                  2. Seluruh tenant aktif akan menerima notifikasi pembaruan peraturan tata tertib.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecutePublish}
                disabled={isPublishing}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0e8a7a] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0c7668] disabled:opacity-50"
              >
                {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Konfirmasi & Terbitkan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Version History Modal (AC 2, AC 4) */}
      {/* ========================================================================= */}
      {isHistoryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Histori Versi Peraturan</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Seluruh versi tersimpan secara immutable untuk audit kepatuhan dan referensi kontrak lama.
                </p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {isLoadingHistory ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-7 w-7 animate-spin text-[#0e8a7a]" />
                </div>
              ) : versionsList.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-400">Belum ada riwayat versi.</div>
              ) : (
                versionsList.map((ver) => {
                  const badge = getVersionStatusBadge(ver.status);
                  return (
                    <div
                      key={ver.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">Versi {ver.version_number}</span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          {ver.change_summary || 'Tidak ada catatan perubahan.'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {ver.published_at ? `Diterbitkan: ${formatDate(ver.published_at)}` : `Dibuat: ${formatDate(ver.created_at)}`}
                          {ver.published_by_name ? ` oleh ${ver.published_by_name}` : ''} · Total {ver.total_items} butir aturan
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleInspectVersion(ver)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" /> Lihat Detail
                        </button>
                        {ver.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsHistoryModalOpen(false);
                              handleOpenAudit(ver.id, ver.version_number);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
                          >
                            <Users className="h-3.5 w-3.5" /> Audit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-200 p-4 text-right">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Inspect Past Version Details Modal */}
      {/* ========================================================================= */}
      {isInspectModalOpen && selectedVersionForInspect && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-slate-900">
                    Detail Peraturan Versi {selectedVersionForInspect.version_number}
                  </h2>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-extrabold ${
                      getVersionStatusBadge(selectedVersionForInspect.status).color
                    }`}
                  >
                    {getVersionStatusBadge(selectedVersionForInspect.status).label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  Snapshot dokumen historis ini bersifat immutable.
                </p>
              </div>
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedVersionForInspect.items.map((item, idx) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-slate-900">
                      {idx + 1}. {item.title}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500">
                      {getCategoryLabel(item.category)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{item.description}</p>
                  {item.details && item.details.length > 0 && (
                    <ul className="mt-2 space-y-1 pl-4">
                      {item.details.map((d, dIdx) => (
                        <li key={dIdx} className="list-disc text-xs text-slate-600">
                          {d}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.penalty_description && (
                    <p className="text-xs font-semibold text-red-700">
                      Sanksi: {item.penalty_description}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-4 text-right">
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Acknowledgments Audit Modal (AC 5) */}
      {/* ========================================================================= */}
      {isAuditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">
                  Audit Persetujuan Peraturan (Versi {auditVersionNumber})
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Rekam jejak persetujuan resmi (timestamp, IP address, user agent, dan pernyataan persetujuan).
                </p>
              </div>
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isLoadingAudit ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-7 w-7 animate-spin text-[#0e8a7a]" />
                </div>
              ) : acknowledgmentsList.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500">
                  Belum ada tenant yang mencatat persetujuan untuk versi ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Tenant & Kamar</th>
                        <th className="px-4 py-3">Waktu Persetujuan</th>
                        <th className="px-4 py-3">IP Address & Device</th>
                        <th className="px-4 py-3">Pernyataan Consent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {acknowledgmentsList.map((ack) => (
                        <tr key={ack.id} className="hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <p className="font-extrabold text-slate-900">{ack.tenant_name}</p>
                            <p className="text-[11px] text-slate-500">
                              Kamar {ack.room_number || '-'} · {ack.tenant_email || ack.tenant_phone}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {formatDate(ack.acknowledged_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-[11px] text-slate-800">{ack.source_ip || '-'}</p>
                            <p className="truncate max-w-[200px] text-[10px] text-slate-400" title={ack.user_agent}>
                              {ack.user_agent || '-'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-600 italic">
                            &quot;{ack.consent_text}&quot;
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 text-right">
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
