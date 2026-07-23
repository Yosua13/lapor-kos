# [EPIC 12] Keuangan Properti, Expense, dan Laporan

- **Prioritas:** P2
- **Tahap roadmap:** Stage 5 - Finance and scale
- **Aktor utama:** Owner, finance, auditor, accountant

## Ringkasan

Menyediakan laporan usaha yang dapat direkonsiliasi dengan invoice, payment, deposit, dan expense. Dashboard membedakan cash received, receivable, deposit liability, refund, serta pendapatan agar owner tidak mengambil keputusan dari angka yang tercampur.

## Tujuan

- Memberikan gambaran keuangan dan operasional per properti yang konsisten.
- Mendukung pencatatan expense serta proses tutup periode yang dapat diaudit.

## Ruang Lingkup

- Dashboard occupancy, billing, collection, aging piutang, cash received, deposit liability, expense, dan net operating income.
- Expense category, vendor, attachment, approval, recurring expense, dan payment status.
- Tampilan cash basis dan receivable yang dipisahkan dengan jelas.
- Period close/lock serta approval untuk adjustment setelah periode ditutup.
- Export CSV/PDF berdasarkan property dan periode dengan metadata audit.

## Rencana Implementasi

- **Backend:** membuat expense dan vendor domain, reporting view, aggregate API, period closure, serta export job.
- **Frontend:** menyediakan dashboard, filter periode/property, drill-down angka, pengelolaan expense, dan proses close.
- **Data dan performa:** menggunakan sumber ledger yang sama, pagination, dan server-side aggregation untuk laporan besar.

## Di Luar Cakupan

- Sistem akuntansi double-entry atau ERP lengkap.
- Pelaporan dan pengajuan pajak otomatis.

## Kriteria Penerimaan

- [ ] Angka dashboard dapat direkonsiliasi ke invoice, payment, allocation, deposit, dan expense.
- [ ] Payment berstatus pending tidak dihitung sebagai cash received.
- [ ] Deposit tidak dihitung sebagai revenue.
- [ ] Adjustment setelah period close membutuhkan approval dan audit trail.
- [ ] Laporan besar menggunakan pagination atau background export tanpa membebani halaman utama.

## Ketergantungan

- EPIC 01 untuk pelaporan per property.
- EPIC 04, EPIC 05, dan EPIC 07 untuk billing, payment, deposit, serta settlement.
- EPIC 13 untuk audit, export security, observability, dan operability.
