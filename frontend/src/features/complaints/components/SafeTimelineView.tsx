'use client';

import React, { useState } from 'react';
import { 
  Calendar, 
  CheckCircle, 
  Clock, 
  Eye, 
  EyeOff, 
  Lock, 
  MessageSquare, 
  RefreshCw, 
  Send, 
  ShieldCheck, 
  User, 
  Wrench
} from 'lucide-react';
import type { ComplaintEvent } from '../types';
import { formatDateTime } from '../format';

interface SafeTimelineViewProps {
  events: ComplaintEvent[];
  isTenant: boolean;
  onAddComment: (message: string, visibility: 'public' | 'internal') => Promise<void>;
  isLoading?: boolean;
}

export function SafeTimelineView({
  events,
  isTenant,
  onAddComment,
  isLoading,
}: SafeTimelineViewProps) {
  const [commentText, setCommentText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(commentText.trim(), isTenant ? 'public' : visibility);
      setCommentText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'created':
        return <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'triaged':
      case 'assigned':
        return <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'work_order_created':
      case 'vendor_scheduled':
        return <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'resolved':
      case 'confirmed':
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'reopened':
        return <RefreshCw className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      default:
        return <Clock className="w-4 h-4 text-zinc-500" />;
    }
  };

  const getActorBadge = (role: string, name: string) => {
    if (role === 'tenant') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <User className="w-3 h-3" />
          {name || 'Penyewa'}
        </span>
      );
    }
    if (role === 'system') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          <ShieldCheck className="w-3 h-3" />
          Sistem Otomatis
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
        <Wrench className="w-3 h-3" />
        {name || 'Pengelola Kos'}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-5">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Riwayat Aktivitas & Timeline
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            {isTenant
              ? 'Transparansi status dan pembaruan pengerjaan yang aman untuk penyewa'
              : 'Audit trail kronologis penanganan tiket, penugasan teknisi, dan catatan internal'}
          </p>
        </div>
        {isTenant ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            <Eye className="w-3.5 h-3.5" />
            Mode Transparan Aman
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
            <Lock className="w-3.5 h-3.5" />
            Audit Trail Lengkap
          </span>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-4 mb-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
        {events.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-400">
            Belum ada aktivitas pada tiket ini.
          </div>
        ) : (
          events.map((evt) => {
            const isInternal = evt.visibility === 'internal';

            return (
              <div key={evt.id} className="relative flex items-start gap-3 pl-1">
                <div className="relative z-10 w-6 h-6 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {getEventIcon(evt.event_type)}
                </div>
                <div
                  className={`flex-1 rounded-xl p-3.5 border text-sm ${
                    isInternal
                      ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
                      : 'bg-zinc-50/80 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {getActorBadge(evt.actor_role, evt.actor_name)}
                      {isInternal && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">
                          <EyeOff className="w-2.5 h-2.5" />
                          Catatan Internal
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(evt.created_at)}
                    </div>
                  </div>
                  <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                    {evt.message}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Comment Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          {isTenant ? 'Kirim Pesan / Respon ke Pengelola' : 'Tambah Catatan / Pembaruan Status'}
        </label>
        <div className="space-y-2.5">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder={
              isTenant
                ? 'Tuliskan informasi tambahan atau pertanyaan Anda di sini...'
                : 'Tuliskan catatan pengerjaan atau update untuk tiket ini...'
            }
            rows={2}
            className="w-full text-sm p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            {!isTenant ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">Visibilitas:</span>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                    visibility === 'public'
                      ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800'
                      : 'text-zinc-500 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  Dapat Dilihat Penyewa
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('internal')}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                    visibility === 'internal'
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
                      : 'text-zinc-500 border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <EyeOff className="w-3 h-3 inline mr-1" />
                  Hanya Internal Staff
                </button>
              </div>
            ) : <div />}

            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Mengirim...' : 'Kirim Update'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
