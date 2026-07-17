# [EPIC 07] Checkout, Inspeksi, dan Settlement

- **Prioritas:** P1
- **Tahap roadmap:** Stage 4 - Operational workflows
- **Aktor utama:** Tenant, owner, staf, finance, sistem

## Ringkasan

Menyediakan proses checkout yang menutup hunian secara operasional dan finansial. Kamar tidak langsung dianggap tersedia sebelum inspeksi, serah terima, tagihan akhir, dan penyelesaian deposit memiliki status yang jelas.

## Tujuan

- Menjamin checkout tidak menghapus histori kontrak maupun pembayaran.
- Menyatukan inspeksi kamar, final statement, refund, dan perubahan akses dalam satu workflow.

## Ruang Lingkup

- Checkout request atau notice dengan tanggal rencana dan alasan.
- Checklist kamar/aset, foto, meter reading akhir, dan serah terima kunci.
- Final statement berisi outstanding, prorata, kerusakan, utility, credit, dan deposit.
- Approval untuk refund, deduction, write-off, atau override.
- Penutupan lease dan occupancy, pembatalan invoice mendatang, penyesuaian akses, serta status cleaning/available kamar.

## Rencana Implementasi

- **Backend:** membuat checkout case, inspection item, settlement statement, deposit entry, approval, dan transisi status yang atomic.
- **Frontend:** menyediakan notice, checklist inspeksi, unggah bukti, review settlement, approval, serta status penyelesaian.
- **Operasi:** mengirim notifikasi dan menyimpan audit trail untuk setiap pengecualian atau perubahan finansial.

## Di Luar Cakupan

- Otomatisasi transfer refund ke rekening tenant.
- Sistem procurement untuk perbaikan kamar setelah checkout.

## Kriteria Penerimaan

- [ ] Kamar tidak menjadi available sebelum inspeksi dan handover selesai, kecuali override beralasan.
- [ ] Deposit berakhir dengan saldo nol atau open refund/payable case yang jelas.
- [ ] Kontrak, invoice, payment, dan bukti historis tetap tersedia.
- [ ] Tenant nonaktif tidak dapat membuat transaksi baru, tetapi akses historis mengikuti kebijakan.
- [ ] Kegagalan proses tidak meninggalkan settlement atau status kamar yang tidak konsisten.

## Ketergantungan

- EPIC 03, EPIC 04, dan EPIC 05 untuk contract, billing, payment, serta deposit ledger.
- EPIC 08 untuk notifikasi.
- EPIC 13 untuk private file, audit, dan kontrol transaksi kritis.
