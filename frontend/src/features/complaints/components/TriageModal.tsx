'use client';

import React, { useState } from 'react';
import { AlertCircle, Clock, ShieldAlert, X } from 'lucide-react';
import type { Complaint, ComplaintImpact, ComplaintPriority } from '../types';

interface TriageModalProps {
  complaint: Complaint;
  isOpen: boolean;
  onClose: () => void;
  onTriageSubmit: (data: {
    priority: ComplaintPriority;
    impact: ComplaintImpact;
    access_window?: string;
    reason?: string;
  }) => Promise<void>;
}

export function TriageModal({
  complaint,
  isOpen,
  onClose,
  onTriageSubmit,
}: TriageModalProps) {
  const [priority, setPriority] = useState<ComplaintPriority>(complaint.priority || 'medium');
  const [impact, setImpact] = useState<ComplaintImpact>(complaint.impact || 'minor');
  const [accessWindow, setAccessWindow] = useState(complaint.access_window || '');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await onTriageSubmit({
        priority,
        impact,
        access_window: accessWindow.trim() || undefined,
        reason: reason.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                Triage Tiket Komplain
              </h3>
              <p className="text-xs text-zinc-500">
                Tentukan tingkat prioritas dan target SLA penanganan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Tingkat Prioritas (SLA Target)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'urgent', label: 'Urgent / Darurat', desc: 'Respon 1 jam • Selesai 12 jam', border: 'border-red-500' },
                { value: 'high', label: 'Tinggi (High)', desc: 'Respon 3 jam • Selesai 24 jam', border: 'border-amber-500' },
                { value: 'medium', label: 'Sedang (Medium)', desc: 'Respon 6 jam • Selesai 48 jam', border: 'border-blue-500' },
                { value: 'low', label: 'Rendah (Low)', desc: 'Respon 24 jam • Selesai 96 jam', border: 'border-emerald-500' },
              ].map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value as ComplaintPriority)}
                  className={`p-2.5 text-left rounded-xl border transition-all ${
                    priority === p.value
                      ? `${p.border} bg-zinc-50 dark:bg-zinc-800 ring-2 ring-blue-500/20`
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {p.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Dampak Masalah
            </label>
            <select
              value={impact}
              onChange={(e) => setImpact(e.target.value as ComplaintImpact)}
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            >
              <option value="emergency">Dampak Kritis (Mengancam keselamatan / kerusakan parah)</option>
              <option value="major">Dampak Mayor (Mengganggu aktivitas harian penyewa)</option>
              <option value="minor">Dampak Minor (Ketidaknyamanan ringan / kosmetik)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Jadwal Akses Kamar (Access Window)
            </label>
            <input
              type="text"
              value={accessWindow}
              onChange={(e) => setAccessWindow(e.target.value)}
              placeholder="Contoh: Senin - Rabu 09:00 - 12:00, atau konfirmasi dulu"
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Alasan Penyesuaian Triage (Opsional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Catatan pertimbangan penyesuaian SLA..."
              className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : 'Terapkan Triage & SLA'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
