'use client';

import React, { useState } from 'react';
import { recordInspections } from '../api';
import type { CheckoutCase, InspectionCondition, InspectionItemInput } from '../types';
import { formatCurrency } from '../format';
import { AlertCircle, CheckCircle2, Key, Plus, Trash2, X, Zap } from 'lucide-react';

interface InspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (checkout: CheckoutCase) => void;
  checkout: CheckoutCase;
}

const DEFAULT_ASSET_ITEMS = [
  'Kasur & Ranjang',
  'AC & Remote AC',
  'Kunci Kamar & Pintu',
  'Kamar Mandi & Sanitasi',
  'Dinding & Kebersihan Cat',
  'Lemari Pakaian',
  'Jendela & Tirai',
];

export const InspectionModal: React.FC<InspectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  checkout,
}) => {
  const [items, setItems] = useState<InspectionItemInput[]>(() => {
    if (checkout.inspections && checkout.inspections.length > 0) {
      return checkout.inspections.map((i) => ({
        item_name: i.item_name,
        condition: i.condition,
        repair_cost_minor: i.repair_cost_minor,
        photo_url: i.photo_url || '',
        notes: i.notes || '',
      }));
    }
    return DEFAULT_ASSET_ITEMS.map((name) => ({
      item_name: name,
      condition: 'good' as InspectionCondition,
      repair_cost_minor: 0,
      photo_url: '',
      notes: '',
    }));
  });

  const [keyReturned, setKeyReturned] = useState(checkout.key_returned);
  const [inspectionNotes, setInspectionNotes] = useState(checkout.inspection_notes || '');

  // Utilities
  const [elecPrev, setElecPrev] = useState(0);
  const [elecCurr, setElecCurr] = useState(0);
  const [elecPrice, setElecPrice] = useState(1500);

  const [waterPrev, setWaterPrev] = useState(0);
  const [waterCurr, setWaterCurr] = useState(0);
  const [waterPrice, setWaterPrice] = useState(5000);

  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalDamageCost = items.reduce((sum, item) => sum + (item.repair_cost_minor || 0), 0);
  const elecCost = elecCurr > elecPrev ? Math.round((elecCurr - elecPrev) * elecPrice) : 0;
  const waterCost = waterCurr > waterPrev ? Math.round((waterCurr - waterPrev) * waterPrice) : 0;
  const totalUtilityCost = elecCost + waterCost;

  const handleItemChange = (index: number, field: keyof InspectionItemInput, value: unknown) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        item_name: newItemName.trim(),
        condition: 'good',
        repair_cost_minor: 0,
        photo_url: '',
        notes: '',
      },
    ]);
    setNewItemName('');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await recordInspections(checkout.id, {
        items,
        key_returned: keyReturned,
        inspection_notes: inspectionNotes.trim(),
        electricity_reading:
          elecCurr > elecPrev
            ? { previous_value: elecPrev, current_value: elecCurr, unit_price_minor: elecPrice }
            : undefined,
        water_reading:
          waterCurr > waterPrev
            ? { previous_value: waterPrev, current_value: waterCurr, unit_price_minor: waterPrice }
            : undefined,
      });
      onSuccess(res);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hasil inspeksi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Inspeksi Kamar & Serah Terima</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kamar {checkout.room_number || '-'} • Penghuni: {checkout.tenant_name || '-'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="m-5 mb-0 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            {/* Handover Kunci Box */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${keyReturned ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40' : 'bg-slate-200 text-slate-500 dark:bg-slate-700'}`}>
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Serah Terima Kunci Kamar & Akses</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {keyReturned ? 'Kunci fisik dan kartu akses telah dikembalikan oleh penghuni' : 'Kunci belum diserahterimakan'}
                  </p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={keyReturned}
                  onChange={(e) => setKeyReturned(e.target.checked)}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all dark:bg-slate-700"></div>
              </label>
            </div>

            {/* Checklist Aset Fisik */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Checklist Aset & Kebersihan Kamar</h3>
                <span className="text-xs font-semibold text-slate-500">
                  Total Kerusakan: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(totalDamageCost)}</strong>
                </span>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 p-3.5 transition dark:border-slate-800 dark:bg-slate-800/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.item_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600"
                        title="Hapus item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Kondisi</label>
                        <select
                          value={item.condition}
                          onChange={(e) => handleItemChange(idx, 'condition', e.target.value as InspectionCondition)}
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="good">Baik</option>
                          <option value="fair">Wajar / Aus</option>
                          <option value="damaged">Rusak</option>
                          <option value="missing">Hilang</option>
                          <option value="dirty">Kotor / Perlu Cuci</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Biaya Perbaikan / Ganti (Rp)</label>
                        <input
                          type="number"
                          min="0"
                          value={item.repair_cost_minor || ''}
                          onChange={(e) => handleItemChange(idx, 'repair_cost_minor', parseInt(e.target.value, 10) || 0)}
                          placeholder="0"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-500">Foto Bukti (URL)</label>
                        <input
                          type="text"
                          value={item.photo_url || ''}
                          onChange={(e) => handleItemChange(idx, 'photo_url', e.target.value)}
                          placeholder="https://..."
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleItemChange(idx, 'notes', e.target.value)}
                        placeholder="Catatan kondisi (e.g. noda di kasur, remote baterai habis)"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Tambah Item Baru */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nama item aset lain..."
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Plus className="h-3.5 w-3.5" /> Tambah Item
                </button>
              </div>
            </div>

            {/* Meter Reading Akhir */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>Meter Reading Akhir (Listrik & Air)</span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  Total Utility: <strong className="text-indigo-600 dark:text-indigo-400">{formatCurrency(totalUtilityCost)}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Listrik */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Listrik (kWh)</span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400">Meter Awal</span>
                      <input
                        type="number"
                        value={elecPrev || ''}
                        onChange={(e) => setElecPrev(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded border border-slate-200 p-1 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Meter Akhir</span>
                      <input
                        type="number"
                        value={elecCurr || ''}
                        onChange={(e) => setElecCurr(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded border border-slate-200 p-1 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-right text-[11px] text-slate-500">
                    Biaya: <strong>{formatCurrency(elecCost)}</strong>
                  </div>
                </div>

                {/* Air */}
                <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Air (m³)</span>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400">Meter Awal</span>
                      <input
                        type="number"
                        value={waterPrev || ''}
                        onChange={(e) => setWaterPrev(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded border border-slate-200 p-1 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400">Meter Akhir</span>
                      <input
                        type="number"
                        value={waterCurr || ''}
                        onChange={(e) => setWaterCurr(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded border border-slate-200 p-1 dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-right text-[11px] text-slate-500">
                    Biaya: <strong>{formatCurrency(waterCost)}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Catatan Keseluruhan */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Catatan Umum Hasil Inspeksi
              </label>
              <textarea
                rows={2}
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                placeholder="Misal: Kamar bersih, kunci lengkap, ada sedikit coretan di dinding dekat meja"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 p-4 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Total Potongan Tambahan: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(totalDamageCost + totalUtilityCost)}</strong>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Tutup
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? 'Menyimpan...' : 'Simpan Hasil Inspeksi'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
