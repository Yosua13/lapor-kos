# [EPIC 05] Payment, Verification, dan Reconciliation

- **Prioritas:** P1
- **Tahap roadmap:** Stage 2 - Revenue integrity
- **Aktor utama:** Tenant, owner, finance, payment provider, sistem

## Ringkasan

Membangun proses pembayaran yang terpisah dari invoice sehingga pembayaran penuh, parsial, gabungan, refund, dan credit dapat dicatat dengan benar. Bukti pembayaran, keputusan verifikasi, allocation, dan receipt memiliki histori yang jelas.

## Tujuan

- Menjaga outstanding invoice berdasarkan transaksi yang benar-benar valid.
- Memudahkan owner melakukan verifikasi dan rekonsiliasi tanpa kehilangan jejak bukti.

## Ruang Lingkup

- Payment submission dengan bukti pembayaran untuk satu atau beberapa invoice.
- Verifikasi manual dengan actor, waktu, dan alasan; serta jalur webhook untuk provider terverifikasi.
- Allocation many-to-many antara payment dan invoice, termasuk pembayaran parsial.
- Penanganan overpayment sebagai tenant credit atau refund case.
- Receipt immutable dan laporan rekonsiliasi payment, allocation, refund, serta settlement.

## Rencana Implementasi

- **Backend:** memisahkan submission, transaction, allocation, refund, credit, dan receipt dengan idempotency provider.
- **Frontend:** menyediakan upload bukti, status verifikasi, alokasi pembayaran, outstanding, receipt, dan tampilan rekonsiliasi bagi finance.
- **Integrasi:** mengirim event pembayaran melalui outbox dan menyiapkan adapter payment provider tanpa mengunci ke satu vendor.

## Di Luar Cakupan

- Implementasi payment gateway penuh dan virtual account pada fase awal.
- Otomatisasi pencairan refund ke bank.

## Kriteria Penerimaan

- [ ] Dua pembayaran parsial memperbarui outstanding tanpa menimpa bukti sebelumnya.
- [ ] Webhook atau retry dengan provider reference yang sama tidak membuat transaksi ganda.
- [ ] Verifikasi hanya dapat dilakukan oleh role berizin pada property terkait.
- [ ] Receipt yang sudah diterbitkan tidak dapat diubah secara diam-diam.
- [ ] Laporan rekonsiliasi dapat menjelaskan payment, allocation, refund, credit, dan settlement.

## Ketergantungan

- EPIC 04 untuk invoice dan outstanding.
- EPIC 08 untuk notification outbox minimum.
- EPIC 13 untuk private proof, audit, dan idempotency monitoring.
