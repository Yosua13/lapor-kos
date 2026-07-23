'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Phone, 
  X, 
  CheckCircle2,
  FileText,
  Plus,
  Edit2,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { CAPABILITIES } from '@/features/authorization/permissions';
import { useAuthorization } from '@/features/authorization/useAuthorization';

interface HouseRule {
  id?: string;
  category: 'keamanan' | 'kebersihan' | 'fasilitas' | 'pembayaran' | 'umum';
  title: string;
  description: string;
  details: string[];
}

type CategoryType = 'semua' | 'keamanan' | 'kebersihan' | 'fasilitas' | 'pembayaran' | 'umum';

const categoryIcons = {
  keamanan: Shield,
  kebersihan: Trash2,
  fasilitas: Zap,
  pembayaran: CreditCard,
  umum: Info,
};

const categoryColors = {
  keamanan: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/50',
  kebersihan: 'text-green-500 bg-green-50 dark:bg-green-950/30 border-green-100 dark:border-green-900/50',
  fasilitas: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50',
  pembayaran: 'text-red-500 bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/50',
  umum: 'text-teal-500 bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900/50',
};

const categoryLabels: Record<CategoryType, string> = {
  semua: 'Semua Kategori',
  keamanan: 'Keamanan & Akses',
  kebersihan: 'Kebersihan',
  fasilitas: 'Fasilitas & Energi',
  pembayaran: 'Keuangan & Pembayaran',
  umum: 'Ketentuan Umum',
};

export default function HouseRulesPage() {
  const { can } = useAuthorization();
  const [rules, setRules] = useState<HouseRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('semua');
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});

  // CRUD Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRule, setEditingRule] = useState<HouseRule | null>(null);
  
  // Delete Dialog States
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<HouseRule | null>(null);

  // Form Fields State
  const [formCategory, setFormCategory] = useState<HouseRule['category']>('umum');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDetails, setFormDetails] = useState<string[]>(['']);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch Rules & User Role
  const fetchData = async (showLoading = false) => {
    if (showLoading) {
      setIsLoading(true);
    }
    try {
      const data = await apiFetch('/api/rules');
      setRules(data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData(false);
  }, []);

  // Toggle single rule accordion
  const toggleRule = (id: string) => {
    setExpandedRules(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Expand all rules
  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    rules.forEach(rule => {
      if (rule.id) allExpanded[rule.id] = true;
    });
    setExpandedRules(allExpanded);
  };

  // Collapse all rules
  const collapseAll = () => {
    setExpandedRules({});
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Open Form Modal (Add mode)
  const handleOpenAdd = () => {
    setEditingRule(null);
    setFormCategory('umum');
    setFormTitle('');
    setFormDescription('');
    setFormDetails(['']);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Form Modal (Edit mode)
  const handleOpenEdit = (rule: HouseRule, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion toggling
    setEditingRule(rule);
    setFormCategory(rule.category);
    setFormTitle(rule.title);
    setFormDescription(rule.description);
    setFormDetails([...rule.details]);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (rule: HouseRule, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent accordion toggling
    setRuleToDelete(rule);
    setIsDeleteOpen(true);
  };

  // Handle Form Detail Changes
  const handleDetailChange = (index: number, value: string) => {
    const updated = [...formDetails];
    updated[index] = value;
    setFormDetails(updated);
  };

  const handleAddDetailRow = () => {
    setFormDetails([...formDetails, '']);
  };

  const handleRemoveDetailRow = (index: number) => {
    if (formDetails.length > 1) {
      setFormDetails(formDetails.filter((_, i) => i !== index));
    }
  };

  // Form Submission (Add & Edit)
  const handleSubmitRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    // Validate details
    const cleanDetails = formDetails.map(d => d.trim()).filter(d => d !== '');
    if (cleanDetails.length === 0) {
      setFormError('Rincian detail peraturan minimal harus diisi 1 poin!');
      setIsSubmitting(false);
      return;
    }

    const payload: HouseRule = {
      category: formCategory,
      title: formTitle.trim(),
      description: formDescription.trim(),
      details: cleanDetails,
    };

    try {
      if (editingRule && editingRule.id) {
        // Edit Mode
        await apiFetch(`/api/rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        // Add Mode
        await apiFetch('/api/rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setIsFormOpen(false);
      await fetchData(true); // Reload rules list
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menyimpan peraturan. Coba lagi.';
      setFormError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Action Execution
  const handleDeleteRule = async () => {
    if (!ruleToDelete || !ruleToDelete.id) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/rules/${ruleToDelete.id}`, {
        method: 'DELETE',
      });
      setIsDeleteOpen(false);
      setRuleToDelete(null);
      await fetchData(true);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Gagal menghapus peraturan.';
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter rules based on search and category
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesCategory = selectedCategory === 'semua' || rule.category === selectedCategory;
      const matchesSearch = 
        rule.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.details.some(detail => detail.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [rules, searchQuery, selectedCategory]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryType, number> = {
      semua: rules.length,
      keamanan: 0,
      kebersihan: 0,
      fasilitas: 0,
      pembayaran: 0,
      umum: 0,
    };
    rules.forEach(rule => {
      if (rule.category in counts) {
        counts[rule.category as CategoryType]++;
      }
    });
    return counts;
  }, [rules]);

  const isOwner = can(CAPABILITIES.RULE_WRITE);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-16">
      {/* Styles for print optimization & animations */}
      <style jsx global>{`
        @media print {
          /* Reset outermost flex container to block layout */
          html, body, .h-screen {
            height: auto !important;
            overflow: visible !important;
            position: static !important;
            display: block !important;
          }
          /* Reset heights/overflow without changing display (avoids sidebar specificity conflict) */
          .h-full, .overflow-hidden, .overflow-y-auto, .flex-1, main, div {
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          /* Hide sidebar, header, and interactive elements */
          aside, aside[class], header, nav, .no-print, button, input, .category-tabs, .owner-actions, .noise-bg {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            width: 100% !important;
          }
          .print-header {
            display: block !important;
            text-align: center;
            margin-bottom: 30px;
          }
          .print-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            break-inside: avoid;
            margin-bottom: 20px !important;
          }
          .print-details {
            display: block !important;
            max-height: none !important;
            opacity: 1 !important;
            padding-top: 12px !important;
          }
          .print-icon {
            display: none !important;
          }
          body {
            color: black !important;
            background: white !important;
          }
        }
      `}</style>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-navy/5 dark:border-white/5 pb-6">
        <div>
          <span className="text-xs font-bold text-brand-teal dark:text-brand-teal/80 tracking-widest uppercase block mb-2">Informasi Hunian</span>
          <h1 className="font-serif text-3xl md:text-4xl text-brand-navy dark:text-white-fixed font-bold">
            Tata Tertib & Peraturan Kos
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Harap baca dan patuhi tata tertib di bawah ini demi kenyamanan, keamanan, dan ketertiban bersama di lingkungan Lapor Kos.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 no-print shrink-0">
          {isOwner && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-3 bg-brand-teal text-white font-bold rounded-2xl text-sm shadow-lg shadow-brand-teal/20 hover:bg-teal-light active:scale-[0.98] transition-all"
            >
              <Plus className="w-4.5 h-4.5" />
              <span>Tambah Aturan</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border border-brand-navy/10 dark:border-white/10 rounded-2xl text-sm font-bold text-brand-navy dark:text-white-fixed hover:bg-gray-50 dark:hover:bg-slate-700/50 shadow-sm active:scale-[0.98] transition-all"
          >
            <Printer className="w-4 h-4 text-brand-teal" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* PRINT-ONLY HEADER */}
      <div className="hidden print-header">
        <h1 style={{ fontSize: '26px', fontWeight: 'bold', fontFamily: 'serif', margin: '0 0 5px 0' }}>Lapor Kos</h1>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 10px 0' }}>TATA TERTIB & PERATURAN RUMAH KOS</h2>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 20px 0' }}>Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <hr style={{ border: '0', borderTop: '2px solid #333', marginBottom: '20px' }} />
      </div>

      {/* SEARCH AND CONTROL BAR */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-3xl border border-brand-navy/5 dark:border-white/5 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full md:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-teal transition-colors w-4 h-4" />
          <input
            type="text"
            placeholder="Cari peraturan (misal: tamu, denda, jam malam)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-brand-cream/50 dark:bg-slate-800/50 border border-brand-navy/5 dark:border-white/5 rounded-2xl py-3 pl-11 pr-10 text-sm font-medium text-brand-navy dark:text-white-fixed focus:outline-none focus:border-brand-teal dark:focus:border-brand-teal focus:bg-white dark:focus:bg-slate-800 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-navy dark:hover:text-white-fixed transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse/Expand Controls */}
        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
          <button
            onClick={expandAll}
            className="text-xs font-bold text-brand-teal hover:underline px-2.5 py-1.5 rounded-lg hover:bg-brand-teal/5 transition-colors"
          >
            Buka Semua
          </button>
          <div className="w-[1px] h-4 bg-gray-200 dark:bg-slate-800" />
          <button
            onClick={collapseAll}
            className="text-xs font-bold text-gray-500 hover:underline px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* CATEGORY TABS */}
      <div className="no-print category-tabs overflow-x-auto no-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
        <div className="flex items-center gap-2 min-w-max">
          {(Object.keys(categoryLabels) as CategoryType[]).map((cat) => {
            const isActive = selectedCategory === cat;
            const count = categoryCounts[cat];
            
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4.5 py-2.5 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-2 border ${
                  isActive
                    ? 'bg-brand-teal text-white border-brand-teal shadow-md shadow-brand-teal/15 scale-95'
                    : 'bg-white dark:bg-slate-900 border-brand-navy/5 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800/80 hover:text-brand-navy dark:hover:text-white-fixed shadow-sm'
                }`}
              >
                <span>{categoryLabels[cat]}</span>
                <span className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RULES ACCORDION LIST */}
      <div className="space-y-4">
        {isLoading ? (
          /* LOADING STATE */
          <div className="text-center py-20 bg-white dark:bg-slate-900 border border-brand-navy/5 dark:border-white/5 rounded-3xl shadow-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-brand-teal" />
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Memuat peraturan dari database...</p>
          </div>
        ) : filteredRules.length > 0 ? (
          filteredRules.map((rule) => {
            const ruleId = rule.id || '';
            const isExpanded = expandedRules[ruleId] || false;
            const IconComponent = categoryIcons[rule.category] || Info;
            const categoryColorClass = categoryColors[rule.category] || '';
            const categoryLabel = categoryLabels[rule.category];

            return (
              <article 
                key={ruleId}
                className="print-card bg-white dark:bg-slate-900 border border-brand-navy/5 dark:border-white/5 rounded-3xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-md dark:shadow-none"
              >
                {/* Accordion Trigger Header */}
                <div
                  onClick={() => toggleRule(ruleId)}
                  className="w-full flex items-start gap-4 p-5 md:p-6 text-left cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                >
                  {/* Category Rounded Icon */}
                  <div className={`print-icon p-3.5 rounded-2xl border shrink-0 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'scale-105 shadow-inner' : ''} ${categoryColorClass}`}>
                    <IconComponent className="w-5 h-5 stroke-[2.25]" />
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 justify-between">
                      <span className={`no-print inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${categoryColorClass}`}>
                        {categoryLabel}
                      </span>
                      
                      {/* Owner CRUD Buttons */}
                      {isOwner && (
                        <div className="owner-actions flex items-center gap-1.5 no-print">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEdit(rule, e)}
                            className="p-1.5 text-gray-400 hover:text-brand-teal hover:bg-teal-50 dark:hover:bg-teal-950/30 rounded-lg transition-colors"
                            title="Edit Peraturan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenDelete(rule, e)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                            title="Hapus Peraturan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl font-bold text-brand-navy dark:text-white-fixed leading-snug">
                      {rule.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-1">
                      {rule.description}
                    </p>
                  </div>

                  {/* Expand/Collapse Chevron Indicator */}
                  <div className="print-icon shrink-0 mt-2 w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-gray-400 hover:text-brand-navy dark:hover:text-white-fixed transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>

                {/* Accordion Detail Body */}
                <div 
                  className={`print-details overflow-hidden transition-all duration-300 ${
                    isExpanded 
                      ? 'max-h-[1000px] opacity-100 border-t border-brand-navy/5 dark:border-white/5 bg-slate-50/30 dark:bg-slate-900/40 p-5 md:p-6' 
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-brand-teal dark:text-brand-teal/80 tracking-wider uppercase">Poin Peraturan Detail:</p>
                    <ul className="grid grid-cols-1 gap-3">
                      {rule.details.map((detail, idx) => (
                        <li 
                          key={idx} 
                          className="flex items-start gap-3.5 text-sm text-brand-navy/80 dark:text-white-fixed/80 leading-relaxed font-medium"
                        >
                          <CheckCircle2 className="print-icon w-5 h-5 text-brand-teal dark:text-brand-teal/70 shrink-0 mt-0.5" />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          /* NO RESULTS BLOCK */
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-brand-navy/5 dark:border-white/5 rounded-3xl shadow-sm">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-700 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-brand-navy dark:text-white-fixed font-serif">Tidak Ada Peraturan Cocok</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1.5 leading-relaxed">
              Kami tidak dapat menemukan peraturan yang cocok dengan kata kunci &ldquo;<span className="font-bold text-brand-teal">{searchQuery}</span>&rdquo; di kategori ini.
            </p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('semua'); }}
              className="mt-5 px-5 py-2.5 bg-brand-teal text-white font-bold text-xs rounded-xl shadow-md hover:bg-brand-teal-light transition-all active:scale-95"
            >
              Reset Filter & Pencarian
            </button>
          </div>
        )}
      </div>

      {/* FOOTER INFO - CONTACT OWNER */}
      {!isOwner && (
        <div className="no-print bg-slate-900 dark:bg-slate-950 text-white-fixed p-6 md:p-8 rounded-[28px] shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
          {/* Background glow decorator */}
          <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-brand-teal/20 blur-[60px] rounded-full -mr-20 -mt-20" />
          
          <div className="space-y-2 relative z-10">
            <h4 className="font-serif text-xl font-bold">Punya Pertanyaan Lain Terkait Peraturan?</h4>
            <p className="text-sm text-white-fixed/60 max-w-lg leading-relaxed">
              Jika Anda ragu atau membutuhkan penjelasan lebih lanjut mengenai tata tertib di atas, silakan hubungi Pemilik Kos langsung untuk berkonsultasi.
            </p>
          </div>

          <a
            href="https://wa.me/#"
            target="_blank"
            rel="noopener noreferrer"
            className="relative z-10 flex items-center gap-2.5 px-6 py-3.5 bg-brand-teal hover:bg-teal-light text-white font-bold rounded-2xl shadow-lg shadow-brand-teal/20 hover:shadow-teal-light/30 active:scale-[0.98] transition-all text-sm group"
          >
            <Phone className="w-4 h-4 group-hover:animate-bounce" />
            <span>Hubungi Pemilik Kos</span>
          </a>
        </div>
      )}

      {/* CRUD MODAL DIALOG (ADD & EDIT) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-8 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Close Button */}
            <button 
              onClick={() => setIsFormOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-navy dark:hover:text-white-fixed transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <header className="mb-6">
              <h3 className="font-serif text-2xl text-brand-navy dark:text-white-fixed font-bold">
                {editingRule ? 'Edit Peraturan Kos' : 'Tambah Peraturan Baru'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Isi form di bawah untuk membuat atau mengubah data peraturan yang berlaku di kos Anda.
              </p>
            </header>

            {formError && (
              <div className="mb-4 flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-semibold animate-fade-up">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitRule} className="space-y-4">
              {/* Category Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Kategori Peraturan</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as HouseRule['category'])}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-brand-navy/5 dark:border-white/5 rounded-xl py-3 px-4 text-sm font-semibold text-brand-navy dark:text-white-fixed focus:outline-none focus:border-brand-teal"
                >
                  <option value="keamanan">Keamanan & Akses</option>
                  <option value="kebersihan">Kebersihan</option>
                  <option value="fasilitas">Fasilitas & Energi</option>
                  <option value="pembayaran">Keuangan & Pembayaran</option>
                  <option value="umum">Ketentuan Umum</option>
                </select>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Judul Peraturan</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Contoh: Batas Kunjungan Tamu"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-brand-navy/5 dark:border-white/5 rounded-xl py-3 px-4 text-sm font-semibold text-brand-navy dark:text-white-fixed focus:outline-none focus:border-brand-teal"
                />
              </div>

              {/* Description Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider ml-1">Deskripsi Singkat</label>
                <textarea
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Berikan ringkasan singkat dari peraturan ini..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-brand-navy/5 dark:border-white/5 rounded-xl py-2.5 px-4 text-sm font-semibold text-brand-navy dark:text-white-fixed focus:outline-none focus:border-brand-teal h-20 resize-none"
                />
              </div>

              {/* Details List Inputs */}
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Poin-poin Rincian Peraturan</label>
                  <button
                    type="button"
                    onClick={handleAddDetailRow}
                    className="text-xs text-brand-teal font-extrabold flex items-center gap-1 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>
                
                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                  {formDetails.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="text-xs font-bold text-gray-400 w-5 text-right">{idx + 1}.</div>
                      <input
                        type="text"
                        required
                        value={detail}
                        onChange={(e) => handleDetailChange(idx, e.target.value)}
                        placeholder={`Masukkan poin ke-${idx + 1}...`}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-brand-navy/5 dark:border-white/5 rounded-xl py-2.5 px-3 text-xs font-semibold text-brand-navy dark:text-white-fixed focus:outline-none focus:border-brand-teal"
                      />
                      {formDetails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDetailRow(idx)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 border border-brand-navy/10 dark:border-white/10 text-brand-navy dark:text-white-fixed font-bold py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-sm disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-teal text-white font-bold py-3.5 rounded-xl hover:bg-teal-light shadow-lg shadow-teal/15 transition-all text-sm flex items-center justify-center gap-1.5 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Peraturan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL DIALOG */}
      {isDeleteOpen && ruleToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-navy/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] p-6 md:p-8 max-w-sm w-full shadow-2xl text-center relative animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500">
              <Trash2 className="w-8 h-8" />
            </div>
            
            <h3 className="font-serif text-xl text-brand-navy dark:text-white-fixed font-bold mb-2">Hapus Peraturan Kos?</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-6">
              Apakah Anda yakin ingin menghapus peraturan &ldquo;<span className="font-semibold text-brand-navy dark:text-white-fixed">{ruleToDelete.title}</span>&rdquo;? Tindakan ini bersifat permanen dan peraturan akan langsung terhapus untuk seluruh penyewa.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => { setIsDeleteOpen(false); setRuleToDelete(null); }}
                className="flex-1 border border-brand-navy/10 dark:border-white/10 text-brand-navy dark:text-white-fixed font-bold py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-xs disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleDeleteRule}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/10 transition-all text-xs flex items-center justify-center gap-1 disabled:opacity-75"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Ya, Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
