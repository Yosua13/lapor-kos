export const formatMoney = (amount: number, currency = 'IDR') => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency,
  maximumFractionDigits: currency === 'IDR' ? 0 : 2,
}).format(amount || 0);

export const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatPeriod = (value?: string | null) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  });
};

export const invoiceStatusLabel: Record<string, string> = {
  draft: 'Draf',
  issued: 'Terbit',
  partially_paid: 'Dibayar sebagian',
  paid: 'Lunas',
  overdue: 'Terlambat',
  void: 'Dibatalkan',
};

export const invoiceStatusTone: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  issued: 'bg-sky-50 text-sky-800 border-sky-200',
  partially_paid: 'bg-amber-50 text-amber-800 border-amber-200',
  paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  overdue: 'bg-rose-50 text-rose-800 border-rose-200',
  void: 'bg-slate-200 text-slate-600 border-slate-300',
};

export const invoiceTypeLabel: Record<string, string> = {
  initial: 'Awal kontrak',
  recurring: 'Rutin',
  final_settlement: 'Penyelesaian akhir',
  adjustment: 'Penyesuaian',
  late_fee: 'Denda',
  legacy: 'Histori lama',
};

export const itemTypeLabel: Record<string, string> = {
  rent: 'Sewa kamar',
  electricity: 'Listrik',
  water: 'Air',
  utility_meter: 'Meteran utility',
  one_off: 'Biaya lain / Deposit',
  discount: 'Diskon',
  credit: 'Kredit',
  late_fee: 'Denda keterlambatan',
  adjustment: 'Penyesuaian',
};
