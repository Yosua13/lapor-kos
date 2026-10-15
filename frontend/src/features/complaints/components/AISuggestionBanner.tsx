'use client';

import React, { useState } from 'react';
import { 
  Bot, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Lightbulb, 
  Sparkles, 
  Wand2 
} from 'lucide-react';
import type { AISuggestion } from '../types';
import { getImpactBadge, getPriorityBadge } from '../format';

interface AISuggestionBannerProps {
  suggestion: AISuggestion | null;
  onApply: (data: {
    apply_priority: boolean;
    apply_category: boolean;
    apply_draft_response: boolean;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function AISuggestionBanner({
  suggestion,
  onApply,
  isLoading,
}: AISuggestionBannerProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [applyPriority, setApplyPriority] = useState(true);
  const [applyCategory, setApplyCategory] = useState(true);
  const [applyDraftResponse, setApplyDraftResponse] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  if (isLoading || !suggestion) return null;

  const priorityBadge = getPriorityBadge(suggestion.suggested_priority);
  const impactBadge = getImpactBadge(suggestion.suggested_impact);

  const handleApply = async () => {
    try {
      setIsApplying(true);
      await onApply({
        apply_priority: applyPriority,
        apply_category: applyCategory,
        apply_draft_response: applyDraftResponse,
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 dark:from-indigo-950/30 dark:via-zinc-900 dark:to-purple-950/20 shadow-xs">
      <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-600 text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                AI Advisory & Rekomendasi Penanganan
              </h4>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                Akurasi {Math.round(suggestion.confidence_score * 100)}%
              </span>
              {suggestion.is_applied && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                  <Check className="w-3 h-3" />
                  Diterapkan
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Saran cerdas berbasis model AI untuk membantu evaluasi triage dan respon komplain
            </p>
          </div>
        </div>

        <button
          type="button"
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-indigo-100/80 dark:border-indigo-900/40 mt-1 space-y-4 text-xs">
          {/* Summary and tags */}
          <div className="p-3 bg-white/80 dark:bg-zinc-900/80 rounded-lg border border-indigo-100 dark:border-indigo-900/40">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-zinc-500 font-medium">Saran Prioritas:</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${priorityBadge.color}`}>
                {priorityBadge.label}
              </span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${impactBadge.color}`}>
                {impactBadge.label}
              </span>
            </div>
            <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
              "{suggestion.summary}"
            </p>
          </div>

          {/* Action Recommendation */}
          {suggestion.recommended_action && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-900 dark:text-amber-200">
              <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Rekomendasi Operasional:</span>{' '}
                {suggestion.recommended_action}
              </div>
            </div>
          )}

          {/* Draft Response */}
          {suggestion.draft_response && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400">
                Draf Tanggapan Empatik untuk Penyewa:
              </span>
              <div className="p-2.5 bg-white/70 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                "{suggestion.draft_response}"
              </div>
            </div>
          )}

          {/* Human Override Controls */}
          {!suggestion.is_applied && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-100 dark:border-indigo-900/40">
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-600 dark:text-zinc-400">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyPriority}
                    onChange={(e) => setApplyPriority(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Terapkan Prioritas ({suggestion.suggested_priority})</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyCategory}
                    onChange={(e) => setApplyCategory(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Terapkan Kategori ({suggestion.suggested_category})</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || (!applyPriority && !applyCategory && !applyDraftResponse)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors disabled:opacity-50 shadow-xs"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {isApplying ? 'Menerapkan...' : 'Terapkan Saran AI'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
