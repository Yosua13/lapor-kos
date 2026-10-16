export const formatAuditAction = (action: string): string => {
  switch (action) {
    case 'payment_verify':
    case 'payment_paid':
      return 'Verifikasi Pembayaran';
    case 'payment_reject':
    case 'payment_rejected':
      return 'Penolakan Pembayaran';
    case 'period_close':
      return 'Tutup Buku Periode';
    case 'period_reopen':
      return 'Buka Kembali Buku';
    case 'adjustment_create':
      return 'Pengajuan Penyesuaian';
    case 'adjustment_approved':
    case 'adjustment_approve':
      return 'Persetujuan Penyesuaian';
    case 'adjustment_rejected':
    case 'adjustment_reject':
      return 'Penolakan Penyesuaian';
    case 'expense_create':
      return 'Pencatatan Biaya';
    case 'expense_approve':
      return 'Persetujuan Biaya';
    case 'expense_pay':
      return 'Pembayaran Pengeluaran';
    case 'expense_delete':
      return 'Penghapusan Biaya';
    default:
      return action.replace(/_/g, ' ').toUpperCase();
  }
};

export const formatEntityType = (entityType: string): string => {
  switch (entityType) {
    case 'payment':
      return 'Pembayaran';
    case 'expense':
      return 'Pengeluaran';
    case 'period_close':
      return 'Periode Buku';
    case 'adjustment':
      return 'Penyesuaian';
    case 'invoice':
      return 'Tagihan / Invoice';
    case 'settlement':
      return 'Penyelesaian Akhir';
    default:
      return entityType;
  }
};

export const formatAuditAmount = (amountMinor: number, currency = 'IDR'): string => {
  if (amountMinor === 0) return '-';
  const isNegative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(abs);

  return isNegative ? `-${formatted}` : formatted;
};

export const formatAuditDateTime = (iso: string): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return iso;
  }
};

export const getHealthBadge = (
  status: string,
): { label: string; className: string } => {
  switch (status.toLowerCase()) {
    case 'ready':
    case 'connected':
    case 'healthy':
    case 'up':
      return {
        label: 'SEHAT (READY)',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'degraded':
      return {
        label: 'DEGRADED',
        className: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    case 'unhealthy':
    case 'error':
    case 'down':
      return {
        label: 'TIDAK SEHAT (DOWN)',
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    default:
      return {
        label: status.toUpperCase(),
        className: 'bg-slate-50 text-slate-700 border-slate-200',
      };
  }
};
